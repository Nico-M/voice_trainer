import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

interface PianoKey {
  // 音名是这颗键的业务主键。
  // 后续无论高亮、显示标签、还是通知外部发声，都靠这个值串起来。
  note: string;
  // 黑键和白键在尺寸、绘制层级、命中顺序上都不同，所以明确区分。
  isBlack: boolean;
  // x 是这颗键在“完整键盘坐标系”中的左边界。
  // 注意它不是当前屏幕看到的位置；当前屏幕里的真实绘制位置要再减去 viewportOffset。
  x: number;
  width: number;
  height: number;
}

export interface MangaPianoProps {
  // 资源尚未就绪时，键盘只展示，不响应触发。
  disabled?: boolean;
  // 用户手动按下键时，通知外层组件。
  onNoteDown?: (note: string) => void;
  // 用户抬手时，通知外层组件释放音符。
  onNoteUp?: (note: string) => void;
  // 外部主动传入要高亮的音符。
  // 典型场景是教学回放/自动播放，这样键盘可以跟着外部状态亮起来。
  pressedNotes?: string[];
  // 当外部指定了 followNote 时，键盘会自动把该音符保持在当前视窗内。
  // 这里主要给自动播放使用，手动拖动预览条时仍然保留原有交互。
  followNote?: string | null;
  // 标记本次练习最初选中的起始音，方便用户知道返程会落回哪里停止。
  startNoteMarker?: string | null;
}

// 一个八度里完整的 12 个半音名称。
const OCTAVE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// 下面这些常量决定了键盘的视觉比例和漫画风格的厚重感。
const WHITE_KEY_WIDTH = 52;
const WHITE_KEY_HEIGHT = 180;
const BLACK_KEY_WIDTH = 32;
const BLACK_KEY_HEIGHT = 110;
const BORDER_WIDTH = 3;
const MANGA_SHADOW = 6;
const MAIN_TOP_MARGIN = 20;
const PREVIEW_HEIGHT = 60;
const PREVIEW_PADDING = 10;
const FOLLOW_NOTE_MARGIN = 36;
const SOLFEGE_MAP: Record<string, string> = {
  C: 'Do',
  'C#': '#Do',
  D: 'Re',
  'D#': '#Re',
  E: 'Mi',
  F: 'Fa',
  'F#': '#Fa',
  G: 'Sol',
  'G#': '#Sol',
  A: 'La',
  'A#': '#La',
  B: 'Si',
};

function getSolfegeLabel(note: string): string {
  // note 形如 C4 / F#3，这里只取音名部分来映射唱名。
  const noteName = note.replace(/\d+$/, '');
  return SOLFEGE_MAP[noteName] ?? noteName;
}

function configureCanvas(
  canvas: HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number,
): CanvasRenderingContext2D | null {
  // 每次绘制前都重新拿 context，确保 canvas 已经挂载并且可用。
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  // Canvas 的 width/height 代表内部像素缓冲区尺寸，不是 CSS 显示尺寸。
  // 这里先把显示尺寸取整并兜底到至少 1，避免初始化阶段出现 0 尺寸。
  const safeWidth = Math.max(1, Math.floor(displayWidth));
  const safeHeight = Math.max(1, Math.floor(displayHeight));
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.floor(safeWidth * dpr);
  const nextHeight = Math.floor(safeHeight * dpr);

  // 移动端高分屏如果不放大 backing store，会出现明显发虚。
  // 所以这里把真实像素尺寸乘上 dpr，但 CSS 尺寸仍保持逻辑尺寸不变。
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    canvas.style.width = `${safeWidth}px`;
    canvas.style.height = `${safeHeight}px`;
  }

  // 设置缩放矩阵后，后续绘图仍然可以继续使用“逻辑像素”坐标。
  // 不需要在每个 draw 调用里手动乘 dpr，代码会简单很多。
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, safeWidth, safeHeight);

  return context;
}

export default function MangaPiano({
  disabled = false,
  onNoteDown,
  onNoteUp,
  pressedNotes = [],
  followNote = null,
  startNoteMarker = null,
}: MangaPianoProps) {
  // 主键盘：负责绘制可视区域里的琴键，并处理按键命中。
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  // 顶部预览条：负责展示完整键盘缩略图，以及拖动当前视窗。
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  // 外层容器：用来读取当前可用宽度，从而算出 viewportWidth。
  const containerRef = useRef<HTMLDivElement>(null);
  // 主键盘按单点交互处理，所以只追踪一个活动 pointer。
  const activeMainPointerIdRef = useRef<number | null>(null);
  // 预览条拖拽同样只允许一个 pointer 接管，避免多指拖动打乱视窗。
  const activePreviewPointerIdRef = useRef<number | null>(null);
  // 用 ref 镜像当前本地按下音，确保 pointer release 时拿到最新值。
  const localActiveNoteRef = useRef<string | null>(null);

  // 当前设备屏幕里能看到多宽的主键盘。
  const [viewportWidth, setViewportWidth] = useState(0);
  // 当前视窗在完整键盘坐标系里的起点。
  // 数值越大，说明主键盘整体“向左平移得越多”，用户看到的是更右边的音区。
  const [viewportOffset, setViewportOffset] = useState(0);
  // 当前用户手指/鼠标正在按住的单个音符。
  // 当前实现先按单点触控设计，所以这里只保存一个音。
  const [localActiveNote, setLocalActiveNote] = useState<string | null>(null);

  // 预览条实际可用宽度，扣掉左右 padding 后得到。
  const previewWidth = Math.max(viewportWidth - PREVIEW_PADDING * 2, 0);
  // 主键盘高度 = 白键高度 + 顶部留白 + 底部标签/视觉缓冲区域。
  const mainCanvasHeight = WHITE_KEY_HEIGHT + MAIN_TOP_MARGIN + 40;

  // 合并组件内部按下态和外部传入的按下态，方便后续接自动演奏或回放。
  // 这样组件不用关心“是谁触发的高亮”，只关心最终有哪些音符需要亮。
  const allActiveNotes = useMemo(() => {
    const set = new Set(pressedNotes);
    if (localActiveNote) set.add(localActiveNote);
    return set;
  }, [pressedNotes, localActiveNote]);

  // 这里按标准 88 键生成从 A0 到 C8 的完整键位数据。
  const keys = useMemo(() => {
    // 先分开存白键和黑键，后面绘制和命中测试都更清楚。
    const whiteKeys: PianoKey[] = [];
    const blackKeys: PianoKey[] = [];
    let currentX = 0;

    // 先铺白键网格，后续黑键直接挂到相邻白键上，坐标会稳定很多。
    // 这是整个坐标体系的基础：
    // 1. 白键决定完整键盘总宽度
    // 2. 黑键位置依赖“前一个白键”
    // 3. 所以先把白键坐标确定下来，后面逻辑会简单很多
    for (let octave = 0; octave <= 8; octave++) {
      for (const noteName of OCTAVE_NOTES) {
        // 标准 88 键不是从 C0 开始，而是从 A0、B0 开始。
        if (octave === 0 && (noteName !== 'A' && noteName !== 'B')) continue;
        // 最高只到 C8，不包含 C#8 之后的音。
        if (octave === 8 && noteName !== 'C') continue;

        const isBlack = noteName.includes('#');
        if (!isBlack) {
          whiteKeys.push({
            note: `${noteName}${octave}`,
            isBlack: false,
            x: currentX,
            width: WHITE_KEY_WIDTH,
            height: WHITE_KEY_HEIGHT,
          });
          currentX += WHITE_KEY_WIDTH;
        }
      }
    }

    // 第二轮只负责黑键。
    // whiteIdx 表示当前遍历到了第几个白键，黑键就挂在它左侧那个白键后面。
    let whiteIdx = 0;
    for (let octave = 0; octave <= 8; octave++) {
      for (const noteName of OCTAVE_NOTES) {
        if (octave === 0 && (noteName !== 'A' && noteName !== 'A#' && noteName !== 'B')) continue;
        if (octave === 8 && noteName !== 'C') continue;

        const isBlack = noteName.includes('#');
        if (isBlack) {
          // 黑键的 x = 左边白键的右边缘，再往左退半个黑键宽度。
          // 这样黑键会自然落在两枚白键之间。
          const prevWhiteKey = whiteKeys[whiteIdx - 1];
          if (prevWhiteKey) {
            blackKeys.push({
              note: `${noteName}${octave}`,
              isBlack: true,
              x: prevWhiteKey.x + WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2,
              width: BLACK_KEY_WIDTH,
              height: BLACK_KEY_HEIGHT,
            });
          }
        } else {
          whiteIdx++;
        }
      }
    }

    // 返回时保留“白键在前、黑键在后”的顺序，
    // 这样默认遍历顺序就更接近实际绘制顺序。
    return [...whiteKeys, ...blackKeys];
  }, []);

  // 下面这两个集合会被重复用于：
  // 1. 主键盘绘制
  // 2. 预览条绘制
  // 3. 点击命中测试
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys]);
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys]);
  // 完整键盘总宽度只看白键数量即可，因为黑键不额外扩展总宽度。
  const totalWidth = useMemo(() => whiteKeys.length * WHITE_KEY_WIDTH, [whiteKeys]);

  const setCurrentLocalActiveNote = useCallback((note: string | null) => {
    // ref 与 state 同步更新，避免 release 时读到陈旧的按下音。
    localActiveNoteRef.current = note;
    setLocalActiveNote(note);
  }, []);

  // 首次进入时把视窗落在中音区附近，避免默认停在 A0 左侧太偏。
  useEffect(() => {
    // 这里有意只在 offset 还是 0 时执行初始化，避免覆盖用户已经拖好的位置。
    if (viewportWidth > 0 && viewportOffset === 0) {
      const c3Key = keys.find(k => k.note === 'C3' && !k.isBlack);
      if (c3Key) {
        setViewportOffset(Math.max(0, Math.min(c3Key.x - 20, totalWidth - viewportWidth)));
      }
    }
  }, [viewportWidth, keys, totalWidth]);

  useEffect(() => {
    if (!followNote || viewportWidth <= 0 || totalWidth <= viewportWidth) return;

    const targetKey = keys.find((key) => key.note === followNote);
    if (!targetKey) return;

    const keyLeft = targetKey.x;
    const keyRight = targetKey.x + targetKey.width;
    const safeVisibleLeft = viewportOffset + FOLLOW_NOTE_MARGIN;
    const safeVisibleRight = viewportOffset + viewportWidth - FOLLOW_NOTE_MARGIN;

    // 自动播放时只在音符已经跑出安全可视区时才移动视窗，
    // 这样既能保证当前音在屏幕里，也不会因为每个音都强制居中而产生抖动。
    if (keyLeft >= safeVisibleLeft && keyRight <= safeVisibleRight) {
      return;
    }

    const keyCenter = keyLeft + targetKey.width / 2;
    const nextOffset = Math.max(
      0,
      Math.min(keyCenter - viewportWidth / 2, totalWidth - viewportWidth),
    );

    setViewportOffset(nextOffset);
  }, [followNote, keys, totalWidth, viewportOffset, viewportWidth]);

  // 视窗宽度跟随容器变化，主键盘和预览条都依赖这个尺寸。
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        // 主键盘不使用原生横向滚动，所以所有可视宽度都靠这里驱动。
        setViewportWidth(containerRef.current.clientWidth);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const drawMain = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    // 每次绘制前都按当前宽度和 DPR 重新配置 canvas，避免模糊或尺寸不同步。
    const ctx = configureCanvas(canvas, viewportWidth, mainCanvasHeight);
    if (!ctx) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const drawKey = (key: PianoKey, isPressed: boolean, isStartMarker: boolean) => {
      const { x, width, height, isBlack, note } = key;
      const solfege = getSolfegeLabel(note);
      // 完整键盘坐标 -> 当前屏幕内绘制坐标。
      // 例如完整键盘里 x=600 的键，如果 viewportOffset=400，
      // 那这颗键当前应该画在屏幕内的 x=200。
      const drawX = x - viewportOffset;

      // 完全在当前视窗外的键不需要绘制，省掉不必要的 canvas 操作。
      if (drawX + width < 0 || drawX > viewportWidth) return;

      ctx.save();
      // 给主键盘顶部留一点空隙，不要让琴键顶到最上边。
      ctx.translate(drawX, MAIN_TOP_MARGIN);

      if (isPressed) {
        // 按下时整体下沉一点，制造“键被压下去”的感觉。
        ctx.translate(0, MANGA_SHADOW / 2);
      }

      // 先画一层粗黑阴影，这是漫画风最重要的厚重感来源。
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width + BORDER_WIDTH, height + MANGA_SHADOW);

      // 再画真正的键体本身。
      ctx.strokeStyle = '#000';
      ctx.lineWidth = BORDER_WIDTH;
      
      if (isBlack) {
        ctx.fillStyle = isPressed ? '#ffde00' : '#333';
      } else {
        ctx.fillStyle = isPressed ? '#ffde00' : '#fff';
      }

      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.fill();
      ctx.stroke();

      // 未按下时补一条高光/质感线，让键体看起来没那么“死平”。
      if (!isPressed) {
        ctx.strokeStyle = isBlack ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.2, height * 0.1);
        ctx.lineTo(width * 0.2, height * 0.9);
        ctx.stroke();
      }

      // 白键和黑键都补上唱名，帮助用户更直观地对照练声。
      // 白键空间更大，用两行分别展示音名和唱名；黑键则压缩成两行小字。
      ctx.textAlign = 'center';
      if (!isBlack) {
        ctx.fillStyle = isPressed ? '#000' : '#555';
        ctx.font = 'bold 15px "Comic Sans MS", cursive, sans-serif';
        ctx.fillText(note, width / 2, height - 34);
        ctx.font = 'bold 13px "Comic Sans MS", cursive, sans-serif';
        ctx.fillText(solfege, width / 2, height - 16);
      } else {
        ctx.fillStyle = isPressed ? '#000' : '#fff';
        ctx.font = 'bold 9px "Comic Sans MS", cursive, sans-serif';
        ctx.fillText(note, width / 2, height - 26);
        ctx.font = 'bold 8px "Comic Sans MS", cursive, sans-serif';
        ctx.fillText(solfege, width / 2, height - 12);
      }

      if (isStartMarker) {
        // 起始音标记故意做得很小，只承担“告诉用户终点在哪”的作用，不抢自动播放高亮的戏。
        ctx.fillStyle = '#ff0064';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width / 2, 14, isBlack ? 10 : 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('S', width / 2, 18);
      }

      ctx.restore();
    };

    // 绘制顺序必须先白后黑。
    // 因为视觉上黑键是压在白键上方的，如果顺序反了，层级会错。
    whiteKeys.forEach(key => drawKey(key, allActiveNotes.has(key.note), key.note === startNoteMarker));
    blackKeys.forEach(key => drawKey(key, allActiveNotes.has(key.note), key.note === startNoteMarker));
  }, [allActiveNotes, blackKeys, mainCanvasHeight, startNoteMarker, viewportOffset, viewportWidth, whiteKeys]);

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || previewWidth <= 0 || totalWidth <= 0) return;
    // 预览条也是 canvas，同样需要 DPR 适配。
    const ctx = configureCanvas(canvas, previewWidth, PREVIEW_HEIGHT);
    if (!ctx) return;

    const w = previewWidth;
    const h = PREVIEW_HEIGHT;
    // 预览条宽度 / 完整键盘宽度 = 缩略图缩放比例。
    const scale = w / totalWidth;

    // 先画预览条背景和边框，让它和主键盘区域形成明显分层。
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // 预览条里的键位也是完整键盘的缩略投影，所以同样先白后黑。
    whiteKeys.forEach(key => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(key.x * scale, 5, key.width * scale, h - 10);
      ctx.strokeRect(key.x * scale, 5, key.width * scale, h - 10);
    });

    blackKeys.forEach(key => {
      ctx.fillStyle = '#333';
      ctx.fillRect(key.x * scale, 5, key.width * scale, (h - 10) * 0.6);
    });

    if (startNoteMarker) {
      const markerKey = keys.find((key) => key.note === startNoteMarker);
      if (markerKey) {
        const markerCenterX = (markerKey.x + markerKey.width / 2) * scale;

        ctx.fillStyle = '#ff0064';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(markerCenterX, 4);
        ctx.lineTo(markerCenterX - 5, 12);
        ctx.lineTo(markerCenterX + 5, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 视窗框表示“当前主键盘屏幕里看到的是完整键盘的哪一段”。
    // viewportOffset 和 viewportWidth 都在完整键盘坐标系里，所以这里要一起乘 scale。
    const vpX = viewportOffset * scale;
    const vpW = viewportWidth * scale;
    
    ctx.fillStyle = 'rgba(255, 0, 100, 0.3)';
    ctx.strokeStyle = '#ff0064';
    ctx.lineWidth = 3;
    ctx.fillRect(vpX, 2, vpW, h - 4);
    ctx.strokeRect(vpX, 2, vpW, h - 4);

    // 中间这个圆点只是视觉提示：告诉用户这里可以拖。
    ctx.fillStyle = '#ff0064';
    ctx.beginPath();
    ctx.arc(vpX + vpW / 2, h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [blackKeys, keys, previewWidth, startNoteMarker, totalWidth, viewportOffset, viewportWidth, whiteKeys]);

  useEffect(() => {
    drawMain();
  }, [drawMain]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const findNoteAtMainCanvasPoint = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = mainCanvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    // 把浏览器事件坐标转换成完整键盘坐标：
    // 1. 先减去 canvas 左上角，得到 canvas 内部坐标
    // 2. x 再加回 viewportOffset，映射到完整键盘坐标系
    // 3. y 再减去顶部留白 MAIN_TOP_MARGIN，得到真实键位区域坐标
    const x = clientX - rect.left + viewportOffset;
    const y = clientY - rect.top - MAIN_TOP_MARGIN;

    // 命中顺序也必须先黑后白。
    // 因为黑键视觉上覆盖在白键上方，同一区域优先命中黑键才符合用户直觉。
    const hitBlack = blackKeys.find((key) =>
      x >= key.x && x <= key.x + key.width && y >= 0 && y <= key.height,
    );

    if (hitBlack) {
      return hitBlack.note;
    }

    const hitWhite = whiteKeys.find((key) =>
      x >= key.x && x <= key.x + key.width && y >= 0 && y <= key.height,
    );
    return hitWhite?.note ?? null;
  }, [blackKeys, viewportOffset, whiteKeys]);

  const releaseLocalActiveNote = useCallback(() => {
    const activeNote = localActiveNoteRef.current;
    if (activeNote && onNoteUp) {
      onNoteUp(activeNote);
    }

    setCurrentLocalActiveNote(null);
  }, [onNoteUp, setCurrentLocalActiveNote]);

  const finishMainPointerInteraction = useCallback((pointerId: number) => {
    if (activeMainPointerIdRef.current !== pointerId) {
      return;
    }

    activeMainPointerIdRef.current = null;
    releaseLocalActiveNote();
  }, [releaseLocalActiveNote]);

  const handleMainPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return;
    }

    // 鼠标场景只响应左键，避免右键/中键误触。
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    // 当前版本按单点处理；已有活动 pointer 时忽略新的输入。
    if (activeMainPointerIdRef.current !== null) {
      return;
    }

    const foundNote = findNoteAtMainCanvasPoint(event.clientX, event.clientY);
    if (!foundNote) {
      return;
    }

    activeMainPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (localActiveNoteRef.current && localActiveNoteRef.current !== foundNote && onNoteUp) {
      onNoteUp(localActiveNoteRef.current);
    }

    if (foundNote !== localActiveNoteRef.current) {
      // 只在真正命中新音时才触发，避免重复 attack 同一键。
      setCurrentLocalActiveNote(foundNote);
      onNoteDown?.(foundNote);
    }
  }, [disabled, findNoteAtMainCanvasPoint, onNoteDown, onNoteUp, setCurrentLocalActiveNote]);

  const handleMainPointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    finishMainPointerInteraction(event.pointerId);
  }, [finishMainPointerInteraction]);

  const handleMainPointerCancel = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    finishMainPointerInteraction(event.pointerId);
  }, [finishMainPointerInteraction]);

  const handleMainLostPointerCapture = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    finishMainPointerInteraction(event.pointerId);
  }, [finishMainPointerInteraction]);

  const handlePreviewMove = useCallback((clientX: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || totalWidth <= viewportWidth) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;

    // 这里做的是“预览条像素坐标 -> 完整键盘坐标”的逆变换。
    const scale = totalWidth / rect.width;
    const x = (clientX - rect.left) * scale;
    
    // 用户拖到哪里，就让视窗中心对准哪里。
    // 这样比“让视窗左边缘对准点击点”更符合直觉。
    let newOffset = x - viewportWidth / 2;
    newOffset = Math.max(0, Math.min(newOffset, totalWidth - viewportWidth));
    setViewportOffset(newOffset);
  }, [totalWidth, viewportWidth]);

  const finishPreviewPointerInteraction = useCallback((pointerId: number) => {
    if (activePreviewPointerIdRef.current !== pointerId) {
      return;
    }

    activePreviewPointerIdRef.current = null;
  }, []);

  const handlePreviewPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    // 鼠标场景只响应左键拖动，避免其他按键干扰视窗。
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (activePreviewPointerIdRef.current !== null) {
      return;
    }

    activePreviewPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    // 按下预览条时先立即同步一次位置，然后进入拖拽态。
    handlePreviewMove(event.clientX);
  }, [handlePreviewMove]);

  const handlePreviewPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePreviewPointerIdRef.current !== event.pointerId) {
      return;
    }

    handlePreviewMove(event.clientX);
  }, [handlePreviewMove]);

  const handlePreviewPointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    finishPreviewPointerInteraction(event.pointerId);
  }, [finishPreviewPointerInteraction]);

  const handlePreviewPointerCancel = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    finishPreviewPointerInteraction(event.pointerId);
  }, [finishPreviewPointerInteraction]);

  const handlePreviewLostPointerCapture = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    finishPreviewPointerInteraction(event.pointerId);
  }, [finishPreviewPointerInteraction]);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', userSelect: 'none', touchAction: 'none' }}>
      {/* 顶部预览条负责拖动视窗，主键盘区域本身只负责按键。 */}
      <div style={{ padding: '10px', background: '#fff', borderBottom: '2px solid #000' }}>
        <canvas
          ref={previewCanvasRef}
          width={previewWidth}
          height={PREVIEW_HEIGHT}
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerCancel}
          onLostPointerCapture={handlePreviewLostPointerCapture}
          style={{ display: 'block', borderRadius: '8px', cursor: 'pointer', touchAction: 'none' }}
        />
      </div>

      {/* 主键盘不使用浏览器原生横向滚动，而是只绘制当前视窗看到的那一段。 */}
      <div style={{ position: 'relative', background: '#eee', height: mainCanvasHeight }}>
        <canvas
          ref={mainCanvasRef}
          width={viewportWidth}
          height={mainCanvasHeight}
          onPointerDown={handleMainPointerDown}
          onPointerUp={handleMainPointerUp}
          onPointerCancel={handleMainPointerCancel}
          onLostPointerCapture={handleMainLostPointerCapture}
          style={{ display: 'block', touchAction: 'none' }}
        />

        {disabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(1px)',
              zIndex: 8,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: '#ffde00',
                border: '4px solid #000',
                boxShadow: '4px 4px 0 #000',
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: 900,
                transform: 'rotate(-2deg)',
              }}
            >
              音色加载中...
            </div>
          </div>
        )}
        
        {/* 用悬浮提示把当前按下音符放大，移动端阅读更轻松。 */}
        {allActiveNotes.size > 0 && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#ffde00',
            padding: '10px 20px',
            border: '4px solid #000',
            fontSize: '24px',
            fontWeight: 'bold',
            transform: 'rotate(5deg)',
            boxShadow: '4px 4px 0 #000',
            zIndex: 10
          }}>
            {Array.from(allActiveNotes).join(' & ')}!
          </div>
        )}
      </div>
    </div>
  );
}

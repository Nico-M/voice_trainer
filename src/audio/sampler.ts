import { Sampler, start } from 'tone';
import noteMapping from '../config/noteMapping.ts';

type SampleConfig = Record<string, string>;
type TriggerAttackReleaseNotes = Parameters<Sampler['triggerAttackRelease']>[0];
type TriggerAttackReleaseDuration = Parameters<Sampler['triggerAttackRelease']>[1];
type TriggerTime = Parameters<Sampler['triggerAttackRelease']>[2];
type TriggerVelocity = Parameters<Sampler['triggerAttackRelease']>[3];
type TriggerAttackNotes = Parameters<Sampler['triggerAttack']>[0];
type TriggerReleaseNotes = Parameters<Sampler['triggerRelease']>[0];

// 用 import.meta.glob 让 Vite 在构建时正确处理音频资源路径。
const sampleAssetModules = import.meta.glob('../assets/piano/*.mp3', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function resolveSampleUrl(configPath: string): string {
  // noteMapping 使用的是配置路径，需要转成当前模块可识别的相对资源路径。
  const normalizedPath = configPath.replace('@assets/', '../assets/');
  const resolvedUrl = sampleAssetModules[normalizedPath];

  if (!resolvedUrl) {
    throw new Error(`未找到采样资源: ${configPath}`);
  }

  return resolvedUrl;
}

function buildSamplerUrls(config: SampleConfig): SampleConfig {
  return Object.fromEntries(
    Object.entries(config).map(([note, configPath]) => [note, resolveSampleUrl(configPath)]),
  );
}

export class MySampler {
  private readonly sampler: Sampler;

  private readonly readyPromise: Promise<void>;

  constructor(config: SampleConfig = noteMapping) {
    const samplerUrls = buildSamplerUrls(config);

    // Tone.Sampler 负责多音高采样回放，这里统一接到默认输出设备。
    this.sampler = new Sampler({
      urls: samplerUrls,
      // 采样钢琴本身音头会比较硬，这里加一点极短的 attack 和稍长的 release，
      // 让练习时相邻音之间的衔接不要那么“断”。
      attack: 0.008,
      release: 0.28,
      onload: () => undefined,
    }).toDestination();

    // Tone 没有直接暴露独立的 onload Promise，这里根据 loaded 状态兜一层。
    this.readyPromise = this.sampler.loaded
      ? Promise.resolve()
      : new Promise((resolve) => {
          const waitUntilLoaded = () => {
            if (this.sampler.loaded) {
              resolve();
              return;
            }

            window.setTimeout(waitUntilLoaded, 20);
          };

          waitUntilLoaded();
        });
  }

  get loaded(): boolean {
    return this.sampler.loaded;
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  async triggerAttackRelease(
    notes: TriggerAttackReleaseNotes,
    duration: TriggerAttackReleaseDuration = '8n',
    time?: TriggerTime,
    velocity?: TriggerVelocity,
  ): Promise<void> {
    // 浏览器里首次播放前需要用户手势触发 AudioContext。
    await start();
    await this.ready();
    this.sampler.triggerAttackRelease(notes, duration, time, velocity);
  }

  async triggerAttack(
    notes: TriggerAttackNotes,
    time?: TriggerTime,
    velocity?: TriggerVelocity,
  ): Promise<void> {
    await start();
    await this.ready();
    this.sampler.triggerAttack(notes, time, velocity);
  }

  async triggerRelease(notes: TriggerReleaseNotes, time?: TriggerTime): Promise<void> {
    await this.ready();
    this.sampler.triggerRelease(notes, time);
  }

  async releaseAll(time?: TriggerTime): Promise<void> {
    await this.ready();
    this.sampler.releaseAll(time);
  }

  dispose(): void {
    this.sampler.dispose();
  }
}

export default MySampler;

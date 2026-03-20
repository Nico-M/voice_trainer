import { useState, type ReactElement } from 'react';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import SettingsVoiceRoundedIcon from '@mui/icons-material/SettingsVoiceRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import {
  EXERCISES,
  MAX_BPM,
  MIN_BPM,
  MODE_LABELS,
  type Exercise,
  type PlayMode,
} from '../config/voiceTrainerExercises.ts';
import {
  getBoundaryNoteOptions,
} from '../utils/voiceTrainerPlaybackUtils.ts';

type ExerciseVisualStatus = 'active' | 'pending' | 'idle';

export interface VoiceTrainerControlsProps {
  activeExerciseId: string | null;
  bpm: number;
  isPlayerReady: boolean;
  lowerBoundNote: string;
  pendingExerciseId: string | null;
  playMode: PlayMode;
  playbackError: string | null;
  selectedExercise: Exercise | null;
  selectedExerciseId: string;
  upperBoundNote: string;
  onBpmChange: (nextBpm: number) => void;
  onExerciseChange: (exerciseId: string) => void;
  onLowerBoundNoteChange: (nextLowerBoundNote: string) => void;
  onPrimaryAction: () => void;
  onToggleMode: () => void;
  onUpperBoundNoteChange: (nextUpperBoundNote: string) => void;
}

const BOUNDARY_NOTE_OPTIONS = getBoundaryNoteOptions();

function getExerciseVisualStatus(
  selectedExerciseId: string,
  activeExerciseId: string | null,
  pendingExerciseId: string | null,
): ExerciseVisualStatus {
  // 当前选中的练习可能处于“正在播放”或“等待选择起始音”两种特殊状态。
  if (activeExerciseId === selectedExerciseId) {
    return 'active';
  }

  if (pendingExerciseId === selectedExerciseId) {
    return 'pending';
  }

  return 'idle';
}

function getExerciseCardBackground(status: ExerciseVisualStatus): string {
  if (status === 'active') {
    return '#aaff00';
  }

  if (status === 'pending') {
    return '#ffde00';
  }

  return '#fff';
}

function getPrimaryButtonBackground(isEnabled: boolean, isEngaged: boolean): string {
  if (!isEnabled) {
    return '#cfcfcf';
  }

  return isEngaged ? '#aaff00' : '#ffde00';
}

function getPrimaryButtonShadow(isEnabled: boolean, isEngaged: boolean): string {
  if (!isEnabled) {
    return '2px 2px 0px #777';
  }

  return isEngaged ? '4px 4px 0px #000' : '4px 4px 0px #ff7a00';
}

function getPrimaryButtonTextColor(isEnabled: boolean): string {
  return isEnabled ? '#000' : '#666';
}

function getPrimaryButtonLabel(
  selectedExerciseId: string,
  activeExerciseId: string | null,
  pendingExerciseId: string | null,
): string {
  if (activeExerciseId !== null) {
    return '停止';
  }

  if (pendingExerciseId !== null) {
    return '待命';
  }

  if (selectedExerciseId) {
    return '开始';
  }

  return '开始';
}

function getModeIcon(playMode: PlayMode): ReactElement {
  if (playMode === 'up') {
    return <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />;
  }

  if (playMode === 'down') {
    return <TrendingDownRoundedIcon sx={{ fontSize: 16 }} />;
  }

  return <RepeatRoundedIcon sx={{ fontSize: 16 }} />;
}

// 主操作按钮会在开始/待命/停止之间切换，图标也跟着语义一起切，减少用户判断成本。
function getPrimaryButtonIcon(
  activeExerciseId: string | null,
  pendingExerciseId: string | null,
): ReactElement {
  if (activeExerciseId !== null) {
    return <StopRoundedIcon sx={{ fontSize: 18 }} />;
  }

  if (pendingExerciseId !== null) {
    return <PauseCircleRoundedIcon sx={{ fontSize: 18 }} />;
  }

  return <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />;
}

function getPendingHint(playMode: PlayMode, lowerBoundNote: string, upperBoundNote: string): string {
  if (playMode === 'up') {
    return `已待命，按键盘上的起始音开始，将在 ${lowerBoundNote} 到 ${upperBoundNote} 范围内上行后折返`;
  }

  if (playMode === 'down') {
    return `已待命，按键盘上的起始音开始，将在 ${lowerBoundNote} 到 ${upperBoundNote} 范围内下行后折返`;
  }

  return '已待命，按键盘上的任意起始音开始';
}

export default function VoiceTrainerControls({
  activeExerciseId,
  bpm,
  isPlayerReady,
  lowerBoundNote,
  pendingExerciseId,
  playMode,
  playbackError,
  selectedExercise,
  selectedExerciseId,
  upperBoundNote,
  onBpmChange,
  onExerciseChange,
  onLowerBoundNoteChange,
  onPrimaryAction,
  onToggleMode,
  onUpperBoundNoteChange,
}: VoiceTrainerControlsProps): ReactElement {
  // 将视觉状态先算出来，下面的样式只消费结果，避免 JSX 里堆积条件判断。
  const exerciseStatus = selectedExerciseId
    ? getExerciseVisualStatus(selectedExerciseId, activeExerciseId, pendingExerciseId)
    : 'idle';
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const isExerciseActive = activeExerciseId !== null;
  const isExercisePending = pendingExerciseId !== null;
  const hasSelectedExercise = selectedExercise !== null;
  const primaryButtonLabel = getPrimaryButtonLabel(
    selectedExerciseId,
    activeExerciseId,
    pendingExerciseId,
  );
  const primaryButtonIcon = getPrimaryButtonIcon(activeExerciseId, pendingExerciseId);
  const isPrimaryActionEnabled = hasSelectedExercise && (isExerciseActive || !isExercisePending);

  function handleExerciseSelect(event: SelectChangeEvent<string>): void {
    onExerciseChange(event.target.value);
  }

  function handleBpmSliderChange(_event: Event, nextValue: number | number[]): void {
    // MUI Slider 兼容单值和区间值，这里只接收单值模式。
    const nextBpm = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    onBpmChange(nextBpm);
  }

  function handleLowerBoundSelect(event: SelectChangeEvent<string>): void {
    onLowerBoundNoteChange(event.target.value);
  }

  function handleUpperBoundSelect(event: SelectChangeEvent<string>): void {
    onUpperBoundNoteChange(event.target.value);
  }

  function openRangeDialog(): void {
    setIsRangeDialogOpen(true);
  }

  function closeRangeDialog(): void {
    setIsRangeDialogOpen(false);
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ mb: 1, px: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 1, mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '1rem' }}>
            WARM-UP SCALES
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ButtonBase onClick={onToggleMode}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: '#000',
                  color: '#fff',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '4px',
                  fontWeight: 900,
                  fontSize: '0.7rem',
                  boxShadow: '3px 3px 0px #ff0064',
                  '&:active': { transform: 'translate(1px, 1px)', boxShadow: 'none' },
                }}
              >
                {getModeIcon(playMode)}
                模式: {MODE_LABELS[playMode]}
              </Box>
            </ButtonBase>
            {playMode !== 'once' && (
              <ButtonBase onClick={openRangeDialog}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.65,
                    bgcolor: '#fff',
                    color: '#000',
                    px: 1.2,
                    py: 0.55,
                    borderRadius: '8px',
                    border: '3px solid #000',
                    boxShadow: '3px 3px 0px #000',
                    fontWeight: 900,
                    fontSize: '0.68rem',
                    '&:active': { transform: 'translate(1px, 1px)', boxShadow: 'none' },
                  }}
                >
                  <TuneRoundedIcon sx={{ fontSize: 16 }} />
                  音域设置
                </Box>
              </ButtonBase>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1,
            bgcolor: '#fff',
            border: '3px solid #000',
            borderRadius: '12px',
            boxShadow: '4px 4px 0px #000',
          }}
        >
          <Typography
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.55,
              fontWeight: 900,
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
            }}
          >
            <SpeedRoundedIcon sx={{ fontSize: 16 }} />
            速度
          </Typography>
          <Slider
            value={bpm}
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            onChange={handleBpmSliderChange}
            aria-label="播放速度"
            sx={{
              color: '#ff0064',
              flex: 1,
              '& .MuiSlider-thumb': {
                width: 18,
                height: 18,
                borderRadius: '5px',
                border: '3px solid #000',
                bgcolor: '#ffde00',
              },
              '& .MuiSlider-track': {
                border: 'none',
                height: 8,
              },
              '& .MuiSlider-rail': {
                height: 8,
                opacity: 1,
                bgcolor: '#000',
              },
            }}
          />
          <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', minWidth: 58, textAlign: 'right' }}>
            {bpm} BPM
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 0.5 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
          <FormControl fullWidth size="small">
            <Select
              value={selectedExerciseId}
              onChange={handleExerciseSelect}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) {
                  return '请选择练习';
                }

                return selectedExercise?.name ?? '请选择练习';
              }}
              sx={{
                bgcolor: '#fff',
                border: '3px solid #000',
                borderRadius: '12px',
                boxShadow: '4px 4px 0px #000',
                fontWeight: 900,
                '& .MuiSelect-select': {
                  py: 1.2,
                },
              }}
            >
              <MenuItem value="" disabled>
                请选择练习
              </MenuItem>
              {EXERCISES.map((exercise) => (
                <MenuItem key={exercise.id} value={exercise.id} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', width: '100%', gap: 1.5, alignItems: 'flex-start' }}>
                    <Typography
                      sx={{
                        minWidth: 52,
                        fontWeight: 900,
                        fontSize: '0.84rem',
                        lineHeight: 1.2,
                        color: '#000',
                        flexShrink: 0,
                      }}
                    >
                      {exercise.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        lineHeight: 1.25,
                        color: '#444',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        flex: 1,
                      }}
                    >
                      {exercise.desc}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ButtonBase
            onClick={onPrimaryAction}
            disabled={!isPrimaryActionEnabled}
            sx={{ display: 'block' }}
          >
            <Box
              sx={{
                minWidth: 96,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.55,
                px: 1.5,
                py: 1,
                bgcolor: getPrimaryButtonBackground(
                  isPrimaryActionEnabled,
                  isExerciseActive || isExercisePending,
                ),
                color: getPrimaryButtonTextColor(isPrimaryActionEnabled),
                border: '3px solid #000',
                borderRadius: '12px',
                boxShadow: getPrimaryButtonShadow(
                  isPrimaryActionEnabled,
                  isExerciseActive || isExercisePending,
                ),
                fontWeight: 900,
                opacity: isPrimaryActionEnabled ? 1 : 0.78,
              }}
            >
              {primaryButtonIcon}
              {primaryButtonLabel}
            </Box>
          </ButtonBase>
        </Box>

        <Paper
          sx={{
            mt: 1,
            p: 1.25,
            border: '3px solid #000',
            borderRadius: '12px',
            boxShadow: '4px 4px 0px #000',
            bgcolor: getExerciseCardBackground(exerciseStatus),
          }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', mb: 0.5 }}>
            当前练习
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '0.92rem', lineHeight: 1.2 }}>
            {selectedExercise?.name ?? '未选择练习'}
          </Typography>
          <Typography sx={{ mt: 0.4, fontSize: '0.75rem', fontWeight: 700 }}>
            {selectedExercise?.desc ?? '先选择练习，再点击开始，然后按键盘上的音符。'}
          </Typography>
          {selectedExercise && playMode !== 'once' && (
            <Typography sx={{ mt: 0.6, fontSize: '0.68rem', fontWeight: 900, color: '#333' }}>
              当前练习音域：{lowerBoundNote} 到 {upperBoundNote}
            </Typography>
          )}
          {!isPlayerReady && (
            <Typography sx={{ mt: 0.6, fontSize: '0.68rem', fontWeight: 900, color: '#ff0064' }}>
              音色加载中，请稍候后再按键盘开始
            </Typography>
          )}
          {hasSelectedExercise && exerciseStatus === 'pending' && (
            <Typography sx={{ mt: 0.6, fontSize: '0.68rem', fontWeight: 900, color: '#ff0064' }}>
              {getPendingHint(playMode, lowerBoundNote, upperBoundNote)}
            </Typography>
          )}
          {playbackError && (
            <Typography sx={{ mt: 0.6, fontSize: '0.68rem', fontWeight: 900, color: '#ff0064' }}>
              {playbackError}
            </Typography>
          )}
        </Paper>
      </Box>

      <Dialog
        open={isRangeDialogOpen}
        onClose={closeRangeDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            border: '3px solid #000',
            borderRadius: '18px',
            boxShadow: '6px 6px 0px #000',
          },
        }}
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontWeight: 900, pb: 0.5 }}
        >
          <SettingsVoiceRoundedIcon sx={{ fontSize: 22 }} />
          设置练习音域
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography sx={{ mb: 1.2, fontSize: '0.74rem', fontWeight: 700, color: '#444' }}>
            自动上下行会在这个范围内折返，回到你的起始音后停止。
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            <FormControl fullWidth size="small">
              <Typography sx={{ mb: 0.4, px: 0.4, fontWeight: 900, fontSize: '0.68rem' }}>
                最低
              </Typography>
              <Select
                value={lowerBoundNote}
                onChange={handleLowerBoundSelect}
                sx={{
                  bgcolor: '#fff',
                  border: '3px solid #000',
                  borderRadius: '12px',
                  boxShadow: '4px 4px 0px #000',
                  fontWeight: 900,
                }}
              >
                {BOUNDARY_NOTE_OPTIONS.map((option) => (
                  <MenuItem key={`lower-${option.value}`} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <Typography sx={{ mb: 0.4, px: 0.4, fontWeight: 900, fontSize: '0.68rem' }}>
                最高
              </Typography>
              <Select
                value={upperBoundNote}
                onChange={handleUpperBoundSelect}
                sx={{
                  bgcolor: '#fff',
                  border: '3px solid #000',
                  borderRadius: '12px',
                  boxShadow: '4px 4px 0px #000',
                  fontWeight: 900,
                }}
              >
                {BOUNDARY_NOTE_OPTIONS.map((option) => (
                  <MenuItem key={`upper-${option.value}`} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Typography sx={{ mt: 1.2, fontSize: '0.72rem', fontWeight: 900, color: '#333' }}>
            当前音域：{lowerBoundNote} 到 {upperBoundNote}
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

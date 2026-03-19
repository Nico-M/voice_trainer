import type { ReactElement } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
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

type ExerciseVisualStatus = 'active' | 'pending' | 'idle';

export interface VoiceTrainerControlsProps {
  activeExerciseId: string | null;
  bpm: number;
  isSamplerReady: boolean;
  pendingExerciseId: string | null;
  playMode: PlayMode;
  selectedExercise: Exercise | null;
  selectedExerciseId: string;
  onBpmChange: (nextBpm: number) => void;
  onExerciseChange: (exerciseId: string) => void;
  onPrimaryAction: () => void;
  onToggleMode: () => void;
}

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

function getStopButtonBackground(isActive: boolean): string {
  return isActive ? '#aaff00' : '#d9d9d9';
}

function getStopButtonShadow(isActive: boolean): string {
  return isActive ? '4px 4px 0px #000' : '2px 2px 0px #777';
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

export default function VoiceTrainerControls({
  activeExerciseId,
  bpm,
  isSamplerReady,
  pendingExerciseId,
  playMode,
  selectedExercise,
  selectedExerciseId,
  onBpmChange,
  onExerciseChange,
  onPrimaryAction,
  onToggleMode,
}: VoiceTrainerControlsProps): ReactElement {
  // 将视觉状态先算出来，下面的样式只消费结果，避免 JSX 里堆积条件判断。
  const exerciseStatus = selectedExerciseId
    ? getExerciseVisualStatus(selectedExerciseId, activeExerciseId, pendingExerciseId)
    : 'idle';
  const isExerciseActive = activeExerciseId !== null;
  const isExercisePending = pendingExerciseId !== null;
  const hasSelectedExercise = selectedExercise !== null;
  const primaryButtonLabel = getPrimaryButtonLabel(
    selectedExerciseId,
    activeExerciseId,
    pendingExerciseId,
  );
  const isPrimaryActionEnabled = hasSelectedExercise && (isExerciseActive || !isExercisePending);

  function handleExerciseSelect(event: SelectChangeEvent<string>): void {
    onExerciseChange(event.target.value);
  }

  function handleBpmSliderChange(_event: Event, nextValue: number | number[]): void {
    // MUI Slider 兼容单值和区间值，这里只接收单值模式。
    const nextBpm = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    onBpmChange(nextBpm);
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ mb: 1, px: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 1, mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
            WARM-UP SCALES
          </Typography>
          <ButtonBase onClick={onToggleMode}>
            <Box
              sx={{
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
              模式: {MODE_LABELS[playMode]}
            </Box>
          </ButtonBase>
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
          <Typography sx={{ fontWeight: 900, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
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
                minWidth: 72,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 1.5,
                py: 1,
                bgcolor: getStopButtonBackground(isExerciseActive || isExercisePending),
                border: '3px solid #000',
                borderRadius: '12px',
                boxShadow: getStopButtonShadow(isExerciseActive || isExercisePending),
                fontWeight: 900,
              }}
            >
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
          {!isSamplerReady && (
            <Typography sx={{ mt: 0.6, fontSize: '0.68rem', fontWeight: 900, color: '#ff0064' }}>
              音色加载中，请稍候后再按键盘开始
            </Typography>
          )}
          {hasSelectedExercise && exerciseStatus === 'pending' && (
            <Typography sx={{ mt: 0.6, fontSize: '0.68rem', fontWeight: 900, color: '#ff0064' }}>
              已选中，按键盘上的任意起始音开始
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

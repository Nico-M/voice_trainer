import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import NativePlayerAdapter from '../audio/nativePlayerAdapter.ts';
import type { PlayerAdapter } from '../audio/playerAdapter.ts';
import TonePlayerAdapter from '../audio/tonePlayerAdapter.ts';

export type PlayerBackendKind = 'android-native-sequence' | 'tonejs-web-audio';

export interface PlayerBackendInfo {
  description: string;
  isNative: boolean;
  kind: PlayerBackendKind;
  label: string;
}

export interface ManagedPlayerController {
  backend: PlayerBackendInfo;
  isPlayerReady: boolean;
  player: PlayerAdapter;
}

interface ManagedPlayerSelection {
  backend: PlayerBackendInfo;
  player: PlayerAdapter;
}

function getPlayerBackendInfo(platform: string): PlayerBackendInfo {
  if (platform === 'android') {
    return {
      description: '正式练习与手动试音都由 Android NativeAudio sequence 链路执行。',
      isNative: true,
      kind: 'android-native-sequence',
      label: 'Android NativeAudio',
    };
  }

  return {
    description: '当前环境继续走 Tone.js + Web Audio 调度链路。',
    isNative: false,
    kind: 'tonejs-web-audio',
    label: 'Tone.js Web Audio',
  };
}

function createManagedPlayer(): ManagedPlayerSelection {
  const platform = Capacitor.getPlatform();

  // 目前只有 Android 原生 sequence 实现可用，其他环境继续走 H5 adapter。
  if (platform === 'android') {
    return {
      backend: getPlayerBackendInfo(platform),
      player: new NativePlayerAdapter(),
    };
  }

  return {
    backend: getPlayerBackendInfo(platform),
    player: new TonePlayerAdapter(),
  };
}

export default function useManagedPlayer(): ManagedPlayerController {
  const [{ backend, player }] = useState<ManagedPlayerSelection>(createManagedPlayer);
  const [isPlayerReady, setIsPlayerReady] = useState(player.isReady());
  const disposeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;

    // React StrictMode 在开发态会做一次额外的 effect cleanup + 重跑。
    // 这里先取消上一次挂起的销毁任务，避免把同一个播放器实例误判成真实卸载后直接 dispose 掉。
    if (disposeTimerRef.current !== null) {
      window.clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }

    void player
      .prepare()
      .then(() => {
        if (disposed) {
          return;
        }

        setIsPlayerReady(player.isReady());
      })
      .catch(() => {
        if (disposed) {
          return;
        }

        setIsPlayerReady(false);
      });

    return () => {
      disposed = true;
      setIsPlayerReady(false);

      // 把真正销毁推迟到下一个 macrotask。
      // 如果只是 StrictMode 的开发态探测，新的 effect 会立刻把这个定时器取消掉；
      // 如果是真实卸载，就会在这一步完成 stop / releaseAll / dispose。
      disposeTimerRef.current = window.setTimeout(() => {
        disposeTimerRef.current = null;

        void player.stop().finally(() => {
          void player.releaseAll().finally(() => {
            void Promise.resolve(player.dispose()).catch(() => undefined);
          });
        });
      }, 0);
    };
  }, [player]);

  return {
    backend,
    isPlayerReady,
    player,
  };
}

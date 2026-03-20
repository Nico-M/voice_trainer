import { useEffect, useRef, useState } from 'react';
import type { PlayerAdapter } from '../audio/playerAdapter.ts';
import TonePlayerAdapter from '../audio/tonePlayerAdapter.ts';

export interface ManagedPlayerController {
  isPlayerReady: boolean;
  player: PlayerAdapter;
}

export default function useManagedPlayer(): ManagedPlayerController {
  const [player] = useState<PlayerAdapter>(() => new TonePlayerAdapter());
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
            player.dispose();
          });
        });
      }, 0);
    };
  }, [player]);

  return {
    isPlayerReady,
    player,
  };
}

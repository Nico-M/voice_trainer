import { useEffect, useRef, useState } from 'react';
import MySampler from '../audio/sampler.ts';

export interface ManagedSamplerController {
  isSamplerReady: boolean;
  isReady: () => boolean;
  triggerAttackRelease: (note: string, duration: number) => Promise<void>;
  triggerAttack: (note: string) => Promise<void>;
  triggerRelease: (note: string) => Promise<void>;
  releaseAll: () => Promise<void>;
}

export default function useManagedSampler(): ManagedSamplerController {
  const samplerRef = useRef<MySampler | null>(null);
  const samplerReadyRef = useRef(false);
  const [isSamplerReady, setIsSamplerReady] = useState(false);

  useEffect(() => {
    const sampler = new MySampler();
    let disposed = false;

    samplerRef.current = sampler;
    samplerReadyRef.current = false;
    setIsSamplerReady(false);

    void sampler.ready().then(() => {
      // 组件已经卸载时，不再回写 ready 状态，避免后续逻辑误判。
      if (disposed) {
        return;
      }

      samplerReadyRef.current = true;
      setIsSamplerReady(true);
    });

    return () => {
      disposed = true;
      samplerReadyRef.current = false;
      setIsSamplerReady(false);

      if (sampler.loaded) {
        void sampler.releaseAll();
      }

      sampler.dispose();
      samplerRef.current = null;
    };
  }, []);

  function getReadySampler(): MySampler | null {
    if (!samplerReadyRef.current) {
      return null;
    }

    return samplerRef.current;
  }

  return {
    isSamplerReady,
    isReady(): boolean {
      return samplerReadyRef.current;
    },
    async triggerAttackRelease(note: string, duration: number): Promise<void> {
      const sampler = getReadySampler();
      if (!sampler) {
        return;
      }

      await sampler.triggerAttackRelease(note, duration);
    },
    async triggerAttack(note: string): Promise<void> {
      const sampler = getReadySampler();
      if (!sampler) {
        return;
      }

      await sampler.triggerAttack(note);
    },
    async triggerRelease(note: string): Promise<void> {
      const sampler = getReadySampler();
      if (!sampler) {
        return;
      }

      await sampler.triggerRelease(note);
    },
    async releaseAll(): Promise<void> {
      const sampler = getReadySampler();
      if (!sampler) {
        return;
      }

      await sampler.releaseAll();
    },
  };
}

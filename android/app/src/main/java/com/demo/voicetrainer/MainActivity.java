package com.demo.voicetrainer;

import android.os.Bundle;
import com.demo.voicetrainer.nativeaudio.NativeAudioPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自定义本地插件必须在 BridgeActivity 完成 load 前注册，
        // 否则 Web 层会认为插件未实现。
        registerPlugin(NativeAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

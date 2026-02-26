import React, { useState } from 'react';
import { api, getErrorMessage } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import { ProButton } from '../Common/Atoms';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip, addClip } = useEditorStore();
  const { showToast } = useToastStore();
  const [isProcessing, setIsProcessing] = useState(false);

  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) { 
      selectedClip = clip; 
      parentTrackId = track.id; 
    }
  });

  if (!selectedClip || !parentTrackId) {
    return <div className="inspector-empty glass-panel"><p>未选中片段</p><small>点击时间轴片段开始炼金</small></div>;
  }

  const currentClip = selectedClip as Clip; // 类型断言以简化后续访问

  const handleUpdate = (updates: Partial<Clip>) => {
    if (parentTrackId && selectedClipId) { 
      updateClip(parentTrackId, selectedClipId, updates); 
    }
  };

  const handleDataUpdate = (dataUpdates: any) => {
    handleUpdate({ data: { ...(currentClip.data || {}), ...dataUpdates } });
  };

  const handleTranslateAndVoice = async (targetLang: string) => {
    if (!currentClip.data?.content || targetLang === 'none') return;
    setIsProcessing(true);
    showToast(`🧬 正在执行语言炼金: ${targetLang}`, 'info');
    try {
      const { data: trans, error: transError } = await api.api.ai.translate.post({ text: currentClip.data.content, targetLang });
      if (transError) {
        showToast(getErrorMessage(transError), 'error');
        return;
      }

      if (trans && 'translatedText' in trans) {
        handleDataUpdate({ content: trans.translatedText });
        const { data: voice, error: voiceError } = await api.api.ai.tts.post({ text: trans.translatedText });
        
        if (voiceError) {
          showToast(getErrorMessage(voiceError), 'error');
          return;
        }

        if (voice && 'audioUrl' in voice) {
          addClip('track-a1', { id: `alc-${Date.now()}`, start: currentClip.start, end: currentClip.end, src: voice.audioUrl, name: `[${targetLang}] 配音`, type: 'audio' });
          showToast('✨ 炼金成功', 'success');
        }
      }
    } catch (e: any) { 
      showToast(e.message, 'error'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleAiRepair = async () => {
    showToast('🔍 正在启动 AI 画面诊断...', 'info');
    try {
      const { data, error } = await api.api.ai.repair.post({ description: '画面存在逻辑不连贯' });
      if (error) {
        showToast(getErrorMessage(error), 'error');
      } else if (data && 'fixPrompt' in data) { 
        showToast(`AI 修复建议: ${data.fixPrompt.substring(0, 20)}...`, 'success'); 
      }
    } catch (e: any) { 
      showToast(e.message, 'error'); 
    }
  };

  const handleSpatialRender = async () => {
    setIsProcessing(true);
    showToast('🧊 正在执行 NeRF 3D 升维...', 'info');
    try {
      const { data, error } = await api.api.ai.spatial.render.post({ clipId: currentClip.id });
      if (error) {
        showToast(getErrorMessage(error), 'error');
      } else if (data?.success) { 
        showToast('✨ 3D 重构完成', 'success'); 
        handleDataUpdate({ is3DReady: true }); 
      }
    } finally { 
      setIsProcessing(false); 
    }
  };

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header"><h3>属性检查器</h3><span className="clip-type-badge">{currentClip.type}</span></header>
      <div className="inspector-body">
        <section className="inspector-section">
          <label>片段名称</label>
          <input type="text" value={currentClip.name} onChange={(e) => handleUpdate({ name: e.target.value })} />
        </section>

        {currentClip.type === 'video' && (
          <section className="inspector-section">
            <div className="alchemy-tools">
              <label className="label-accent">🧊 空间升维 (Spatial AI)</label>
              <ProButton onClick={handleSpatialRender} isLoading={isProcessing} className="w-full">执行 NeRF 3D 重构</ProButton>
            </div>
            <ProButton variant="secondary" onClick={handleAiRepair} className="w-full mt-4">🛠️ AI 画面修复</ProButton>
          </section>
        )}

        {currentClip.type === 'text' && (
          <section className="inspector-section special">
            <label>文字内容</label>
            <textarea value={currentClip.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} />
            <div className="alchemy-tools mt-4">
              <label className="label-accent">🧬 炼金：多语种翻译</label>
              <select onChange={(e) => handleTranslateAndVoice(e.target.value)} disabled={isProcessing} className="pro-select mt-2">
                <option value="none">选择目标语言...</option>
                <option value="English">英语 (US)</option>
                <option value="Japanese">日语 (JP)</option>
              </select>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;

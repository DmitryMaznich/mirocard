import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { loadRenderer } from "@/topics/rendererLoader";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { accountKv } from "@/topics/accountKv";

// «Печатные буквы» owns a full screen, like propis2's Propis2Home (owner, 2026-11-03: the
// constructor must not sit under the session header). App's ParamsRoute sends the topic here
// instead of the settings screen; the renderer itself comes from the installed deck ZIP
// (loadRenderer), the bundled copy until that has loaded or if it fails.
export default function PrintLettersScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const activeModeId = useAppStore((s) => s.activeModeId);
  const record = useAppStore((s) => s.topicRecords.find((r) => r.meta.id === s.activeTopicId));
  const mode = record?.modes?.find((m) => m.id === activeModeId) ?? record?.modes?.[0];

  const [Renderer, setRenderer] = useState(() => RENDERER_REGISTRY.print_letters ?? null);
  useEffect(() => {
    if (!activeTopicId) return undefined;
    let alive = true;
    loadRenderer(activeTopicId).then((R) => { if (alive && R) setRenderer(() => R); }).catch(() => {});
    return () => { alive = false; };
  }, [activeTopicId]);

  const task = useMemo(() => (record && mode ? ENGINE_REGISTRY.print_letters?.(mode, record.cards)?.[0] ?? null : null), [record, mode]);
  const onBack = () => setScreen((record?.modes?.length ?? 0) > 1 ? "modes" : "home");

  if (!record || !Renderer || !task) return <div className="screen-center">Загрузка…</div>;
  return <Renderer task={task} topicRecord={record} accountKv={accountKv} onBack={onBack} fullScreen />;
}

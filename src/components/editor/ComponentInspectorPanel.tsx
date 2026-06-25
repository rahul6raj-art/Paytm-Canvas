"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  Component,
  Copy,
  MoreHorizontal,
  RotateCcw,
  Unlink,
  Upload,
} from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { findInstanceRoot, groupComponentMasters, listComponentMasters } from "@/lib/componentModel";
import { buildComponentDefinition } from "@/lib/components/resolveInstance";
import { countOverrides, readInstanceOverrideMap } from "@/lib/components/overrides";
import { componentDisplayName } from "@/lib/components/folders";
import { findVariantGroupForMaster } from "@/lib/componentUx";
import { PropertiesSection } from "@/components/editor/PropertiesSection";
import { PropertyTextInput } from "@/components/editor/PropertyInput";
import { InstanceVariantControls } from "@/components/editor/component-inspector/InstanceVariantControls";
import { InstancePropertyControls } from "@/components/editor/component-inspector/InstancePropertyControls";
import { SlotPropertyControls } from "@/components/editor/component-inspector/SlotPropertyControls";
import { buildSlotTextContentSnapshot } from "@/lib/components/componentSlots";
import { MasterPropertyEditor } from "@/components/editor/component-inspector/MasterPropertyEditor";
import { MasterVariantEditor } from "@/components/editor/component-inspector/MasterVariantEditor";
import { ComponentInteractionsEditor } from "@/components/editor/component-inspector/ComponentInteractionsEditor";

type Props = {
  nodeId: string;
  locked?: boolean;
};

export function ComponentInspectorPanel({ nodeId, locked }: Props) {
  const nodes = useEditorStore((s) => s.nodes);
  const node = nodes[nodeId];
  const instRootId = findInstanceRoot(nodes, nodeId);
  const instRoot = instRootId ? nodes[instRootId] : null;
  const isMaster = Boolean(node?.isComponent);
  const isInstance = Boolean(instRootId);

  const goToMainComponent = useEditorStore((s) => s.goToMainComponent);
  const resetInstanceOverrides = useEditorStore((s) => s.resetInstanceOverrides);
  const detachInstance = useEditorStore((s) => s.detachInstance);
  const swapInstanceComponent = useEditorStore((s) => s.swapInstanceComponent);
  const setInstanceVariant = useEditorStore((s) => s.setInstanceVariant);
  const pushInstanceChangesToMain = useEditorStore((s) => s.pushInstanceChangesToMain);
  const setComponentDescription = useEditorStore((s) => s.setComponentDescription);
  const addComponentProperty = useEditorStore((s) => s.addComponentProperty);
  const setComponentPropertyValue = useEditorStore((s) => s.setComponentPropertyValue);
  const resetComponentPropertyValue = useEditorStore((s) => s.resetComponentPropertyValue);
  const createInstanceSwapPropertyFromSelection = useEditorStore(
    (s) => s.createInstanceSwapPropertyFromSelection,
  );
  const updateComponentProperty = useEditorStore((s) => s.updateComponentProperty);
  const setSlotContent = useEditorStore((s) => s.setSlotContent);
  const resetSlotContent = useEditorStore((s) => s.resetSlotContent);
  const enterSlotEditMode = useEditorStore((s) => s.enterSlotEditMode);
  const exitSlotEditMode = useEditorStore((s) => s.exitSlotEditMode);
  const activeSlotEdit = useEditorStore((s) => s.activeSlotEdit);
  const createSlotPropertyFromSelection = useEditorStore((s) => s.createSlotPropertyFromSelection);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const createVariantFromComponent = useEditorStore((s) => s.createVariantFromComponent);
  const updateVariantProperties = useEditorStore((s) => s.updateVariantProperties);
  const addVariantPropertyAxis = useEditorStore((s) => s.addVariantPropertyAxis);
  const renameVariantProperty = useEditorStore((s) => s.renameVariantProperty);
  const deleteVariantProperty = useEditorStore((s) => s.deleteVariantProperty);
  const addVariantPropertyValue = useEditorStore((s) => s.addVariantPropertyValue);
  const duplicateVariantMaster = useEditorStore((s) => s.duplicateVariantMaster);
  const deleteVariantMaster = useEditorStore((s) => s.deleteVariantMaster);
  const setComponentInteractions = useEditorStore((s) => s.setComponentInteractions);
  const addComponentInteraction = useEditorStore((s) => s.addComponentInteraction);
  const updateComponentInteraction = useEditorStore((s) => s.updateComponentInteraction);
  const removeComponentInteraction = useEditorStore((s) => s.removeComponentInteraction);
  const componentInteractionPreview = useEditorStore((s) => s.componentInteractionPreview);
  const setComponentInteractionPreview = useEditorStore((s) => s.setComponentInteractionPreview);

  const [menuOpen, setMenuOpen] = useState(false);

  const master = useMemo(() => {
    if (isMaster && node) return node;
    if (!instRoot?.sourceComponentId) return null;
    return nodes[instRoot.sourceComponentId] ?? null;
  }, [isMaster, isInstance, instRoot, node, nodes]);

  const definition = useMemo(
    () => (master ? buildComponentDefinition(nodes, master.id) : null),
    [master, nodes],
  );

  const overrideMap = instRoot ? readInstanceOverrideMap(instRoot) : {};
  const overrideCount = countOverrides(overrideMap);

  const variantGroup = useMemo(() => {
    if (!master) return null;
    return findVariantGroupForMaster(nodes, master.id);
  }, [master, nodes]);

  if (!isMaster && !isInstance) return null;

  return (
    <div data-testid="component-inspector">
    <PropertiesSection title="Component" defaultOpen>
      {isInstance && instRoot && master ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-300/35 bg-violet-300/12 px-2 py-0.5 text-ui font-medium text-violet-50">
              <Boxes className="h-3 w-3" strokeWidth={1.75} />
              Instance
            </span>
            {overrideCount > 0 ? (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-ui text-amber-200">
                {overrideCount} override{overrideCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <div>
            <p className="text-ui text-app-subtle">Component</p>
            <p className="text-ui font-medium text-app-fg">
              {variantGroup && variantGroup.variants.length > 1
                ? variantGroup.label
                : componentDisplayName(master.name)}
            </p>
          </div>

          {variantGroup && variantGroup.variants.length > 1 ? (
            <InstanceVariantControls
              group={variantGroup}
              selected={instRoot.selectedVariantProperties ?? master.variantProperties}
              disabled={locked}
              onChange={(props) => setInstanceVariant(instRootId!, props)}
            />
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={locked}
              data-testid="go-to-main-component"
              onClick={() => goToMainComponent(instRootId!)}
              className="inspector-section-action flex-1"
            >
              <Component className="h-3.5 w-3.5" strokeWidth={1.75} />
              Go to main
            </button>
            <button
              type="button"
              disabled={locked || overrideCount === 0}
              data-testid="reset-all-overrides"
              onClick={() => resetInstanceOverrides(instRootId!)}
              className="inspector-section-action flex-1"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
              Reset all
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-ui text-app-subtle">Swap component</span>
            <select
              disabled={locked}
              data-testid="swap-instance-component"
              className="h-8 rounded-md border border-app-border bg-app-field px-2 text-ui"
              value={variantGroup?.id ?? master.id}
              onChange={(e) => {
                const group = groupComponentMasters(listComponentMasters(nodes), nodes).find(
                  (g) => g.id === e.target.value,
                );
                const nextMaster = group ? group.variants[0]! : nodes[e.target.value];
                if (nextMaster) swapInstanceComponent(instRootId!, nextMaster.id);
              }}
            >
              {groupComponentMasters(listComponentMasters(nodes), nodes).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          <InstancePropertyControls
            instRoot={instRoot}
            master={master}
            allNodes={nodes}
            locked={locked}
            onSetProperty={(key, value) => setComponentPropertyValue(instRootId!, key, value)}
            onResetProperty={(stableId, path) => resetInstanceOverrides(instRootId!, stableId, path)}
            onResetSwapProperty={(key) => resetComponentPropertyValue(instRootId!, key)}
          />

          <SlotPropertyControls
            defs={master.componentPropertyDefs ?? []}
            instRoot={instRoot}
            instRootId={instRootId!}
            locked={locked}
            activeSlotEdit={activeSlotEdit}
            onEnterEdit={(key) => enterSlotEditMode(instRootId!, key)}
            onExitEdit={() => exitSlotEditMode(true)}
            onReset={(key) => resetSlotContent(instRootId!, key)}
            onReplaceWithText={(key, content) =>
              setSlotContent(instRootId!, key, buildSlotTextContentSnapshot(content))
            }
          />

          <div className="relative">
            <button
              type="button"
              disabled={locked}
              onClick={() => setMenuOpen((v) => !v)}
              className="inspector-section-action w-full !justify-between"
            >
              <span className="inline-flex items-center gap-1.5">
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                More actions
              </span>
            </button>
            {menuOpen ? (
              <div className="mt-1 rounded-lg border border-app-border bg-app-panel p-1 shadow-lg">
                <button
                  type="button"
                  className="editor-menu-dropdown-item w-full"
                  onClick={() => {
                    pushInstanceChangesToMain(instRootId!);
                    setMenuOpen(false);
                  }}
                >
                  <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Push changes to main
                </button>
                <button
                  type="button"
                  className="editor-menu-dropdown-item w-full text-red-300"
                  data-testid="detach-instance"
                  onClick={() => {
                    detachInstance(instRootId!);
                    setMenuOpen(false);
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Detach instance
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isMaster && node ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-400/18 px-2 py-0.5 text-ui font-medium text-violet-50">
              <Component className="h-3 w-3" strokeWidth={1.75} />
              Main component
            </span>
            <span className="text-ui text-app-subtle">v{definition?.version ?? 1}</span>
          </div>

          <div>
            <p className="text-ui text-app-subtle">Component</p>
            <p className="text-ui font-medium text-app-fg">
              {variantGroup && variantGroup.variants.length > 1
                ? variantGroup.label
                : componentDisplayName(node.name)}
            </p>
          </div>

          {variantGroup ? (
            <>
              <MasterVariantEditor
                master={node}
                group={variantGroup}
                locked={locked}
                onUpdateAxis={(axis, value) =>
                  updateVariantProperties(node.componentId ?? node.id, { [axis]: value })
                }
                onAddAxis={(axis, defaultValue) =>
                  addVariantPropertyAxis(node.id, axis, defaultValue)
                }
                onRenameProperty={(oldName, newName) =>
                  renameVariantProperty(node.id, oldName, newName)
                }
                onDeleteProperty={(propertyName) => deleteVariantProperty(node.id, propertyName)}
                onAddPropertyValue={(propertyName, value) =>
                  addVariantPropertyValue(node.id, propertyName, value)
                }
                onAddVariant={() => createVariantFromComponent(node.componentId ?? node.id)}
                onDuplicateVariant={
                  variantGroup.variants.length > 1
                    ? () => duplicateVariantMaster(node.id)
                    : undefined
                }
                onDeleteVariant={
                  variantGroup.variants.length > 1
                    ? () => deleteVariantMaster(node.id)
                    : undefined
                }
              />
              {variantGroup.variants.length > 1 ? (
                <>
                  <ComponentInteractionsEditor
                master={node}
                group={variantGroup}
                locked={locked}
                onAdd={(interaction) => addComponentInteraction(node.id, interaction)}
                onUpdate={(interactionId, patch) =>
                  updateComponentInteraction(node.id, interactionId, patch)
                }
                onRemove={(interactionId) => removeComponentInteraction(node.id, interactionId)}
              />
              <label className="flex items-center justify-between gap-2 rounded-md border border-violet-300/25 bg-violet-300/8 px-2 py-1.5">
                <span className="text-ui text-app-fg">Prototype preview (interactions)</span>
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={componentInteractionPreview}
                  data-testid="component-interaction-preview-toggle"
                  onChange={(e) => setComponentInteractionPreview(e.target.checked)}
                />
              </label>
                </>
              ) : null}
            </>
          ) : null}

          <PropertyTextInput
            label="Description"
            value={node.componentDescription ?? ""}
            instanceKey={`${node.id}-desc`}
            onCommit={(v) => setComponentDescription(node.id, v)}
          />

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={locked}
              data-testid="create-instance-from-inspector"
              onClick={() => setPlacingComponentMasterId(node.id)}
              className="inspector-section-action"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              Create instance
            </button>
          </div>

          <MasterPropertyEditor
            master={node}
            locked={locked}
            onAddProperty={(def) => addComponentProperty(node.id, def)}
            onUpdateProperty={(propertyId, patch) => updateComponentProperty(node.id, propertyId, patch)}
            onCreateSwapFromSelection={(nestedId, label) =>
              createInstanceSwapPropertyFromSelection(node.id, nestedId, label)
            }
            onCreateSlotFromSelection={(containerId, label) =>
              createSlotPropertyFromSelection(node.id, containerId, label)
            }
          />
        </div>
      ) : null}
    </PropertiesSection>
    </div>
  );
}

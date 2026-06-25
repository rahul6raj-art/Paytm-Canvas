import type { EditorNode } from "@/stores/useEditorStore";
import { groupComponentMasters, libraryPanelMasters, listComponentMasters } from "@/lib/componentModel";

export type ComponentFolderNode = {
  name: string;
  path: string;
  children: ComponentFolderNode[];
  components: EditorNode[];
};

export function componentFolderPath(name: string): string[] {
  return name
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function componentDisplayName(name: string): string {
  const parts = componentFolderPath(name);
  return parts[parts.length - 1] ?? name;
}

export function buildComponentFolderTree(masters: EditorNode[]): ComponentFolderNode {
  const root: ComponentFolderNode = { name: "", path: "", children: [], components: [] };

  for (const master of masters) {
    const parts = componentFolderPath(master.name);
    if (parts.length <= 1) {
      root.components.push(master);
      continue;
    }
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]!;
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === seg);
      if (!child) {
        child = { name: seg, path, children: [], components: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.components.push(master);
  }

  const sortTree = (n: ComponentFolderNode) => {
    n.children.sort((a, b) => a.name.localeCompare(b.name));
    n.components.sort((a, b) => a.name.localeCompare(b.name));
    for (const c of n.children) sortTree(c);
  };
  sortTree(root);
  return root;
}

export function flattenFolderTree(
  node: ComponentFolderNode,
  depth = 0,
): { master: EditorNode; depth: number; folderPath: string }[] {
  const out: { master: EditorNode; depth: number; folderPath: string }[] = [];
  for (const m of node.components) {
    out.push({ master: m, depth, folderPath: node.path });
  }
  for (const child of node.children) {
    out.push(...flattenFolderTree(child, depth + 1));
  }
  return out;
}

export function localComponentMasters(nodes: Record<string, EditorNode>): EditorNode[] {
  return listComponentMasters(nodes).filter((m) => !m.libraryId);
}

/** Local masters for the components panel — one entry per variant set. */
export function localComponentPanelMasters(nodes: Record<string, EditorNode>): EditorNode[] {
  const masters = localComponentMasters(nodes);
  return libraryPanelMasters(masters, nodes);
}

export function libraryComponentPlaceholder(): { id: string; name: string; description: string }[] {
  return [
    { id: "lib-placeholder-1", name: "Design System / Button", description: "Team library (coming soon)" },
    { id: "lib-placeholder-2", name: "Design System / Input", description: "Team library (coming soon)" },
  ];
}

export function groupedLocalMasters(nodes: Record<string, EditorNode>) {
  return groupComponentMasters(localComponentMasters(nodes), nodes);
}

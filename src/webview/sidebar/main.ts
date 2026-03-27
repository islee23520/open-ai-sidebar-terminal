import { SessionTree } from "./SessionTree";
import { SessionTreeRenderer } from "./SessionTreeRenderer";
import { TreeSnapshot } from "./types";

export function initSidebar(_vscode: unknown) {
  const sidebarContainer = document.getElementById("sidebar-container");
  if (!sidebarContainer) return;

  const tree = new SessionTree();
  const renderer = new SessionTreeRenderer(sidebarContainer, (groupName) => {
    tree.toggleGroup(groupName);
  });

  tree.subscribe((state) => {
    renderer.render(state);
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message && message.type === "treeSnapshot") {
      tree.updateFromSnapshot(message as TreeSnapshot);
    }
  });
}

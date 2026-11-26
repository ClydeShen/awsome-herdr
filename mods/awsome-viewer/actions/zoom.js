// The preview column's zoom (docs/REQUIREMENTS.md section 4.4b): a layout block can't take
// pane.zoom, so zooming hides the blocks beside it and putting them back ends it.
import { focused, layout, run, setShared, shared } from "herdr";

const ZOOM = "awsome-viewer.zoom";
const SLOT_NODE = "preview";

const node = (id) => {
  const find = (n) => (n?.id === id ? n : (n?.children ?? []).map(find).find(Boolean));
  return find(layout());
};

// { panel, tab, pane } while zoomed: whether the side panel was shown, and where focus was.
export const zoomState = () => shared(ZOOM) ?? null;

export function zoomIn() {
  const panel = node("panel");
  const panelShown = Boolean(panel && !panel.hidden);
  const at = focused();
  setShared(ZOOM, { panel: panelShown, tab: at?.tab ?? null, pane: at?.pane ?? null });
  run("layout.hide", { id: "main" });
  if (panelShown) run("layout.hide", { id: "panel" });
}

export function zoomOut() {
  const state = zoomState();
  if (!state) return;
  setShared(ZOOM, null);
  run("layout.show", { id: "main" });
  if (state.panel) run("layout.show", { id: "panel" });
}

// Ends the zoom once what it zoomed is gone or focus moved to another tab or pane, the way a
// zoomed pane is left behind when you go elsewhere.
export function zoomStillFits(slotShown) {
  const state = zoomState();
  if (!state) return;
  const at = focused();
  if (!slotShown || at?.tab !== state.tab || at?.pane !== state.pane) zoomOut();
}

// Closes the preview column, putting the blocks a zoom hid back first.
export function hideSlot() {
  zoomOut();
  run("layout.hide", { id: SLOT_NODE });
}

// The editor's two questions (docs/REQUIREMENTS.md section 4.8): "Save changes to 1 file?" before
// the preview column lets go of edited text, and "Overwrite 1 file changed on disk?" when a
// save finds the file changed since it was read. Each is its own copy of this mod, opened as
// a dialog; the answer comes back to the viewer that asked through shared state, the way the
// sidebar's prompt box does (actions/agents.js).
import { div } from "gpui-kit";
import { closeOverlay, openOverlay, props, setShared, shared } from "herdr";
import { CONFIRM, confirmHeight, confirmKey, confirmView } from "../confirm.js";
import { codeFont } from "./ui.js";

export const ANSWER = "awsome-viewer.answer";

const QUESTIONS = {
  unsaved: (name) => ({
    title: "Save changes to 1 file?",
    names: [name],
    note: "Unsaved changes will be lost.",
    action: "Save",
    danger: false,
  }),
  conflict: (name) => ({
    title: "Overwrite 1 file changed on disk?",
    names: [name],
    note: "It changed after you opened it.",
    action: "Overwrite",
    danger: true,
  }),
};

export const askMethods = {
  // In the viewer: ask, and run `then(choice, cx)` with "yes", "other" or "cancel".
  ask(kind, name, then) {
    if (this.asking) return;
    const at = Date.now();
    this.asking = { at, then };
    const question = QUESTIONS[kind](name);
    openOverlay({
      mod: "awsome-viewer",
      kind: "dialog",
      modal: true,
      frame: "none",
      width: CONFIRM.width,
      height: confirmHeight(question),
      props: { mode: "ask", ask: { kind, name, viewer: this.viewerId, at } },
    });
  },

  // In the viewer, on each sync: the answer to this viewer's question, once.
  takeAnswer(cx) {
    const answer = shared(ANSWER);
    const asking = this.asking;
    if (!asking || !answer || answer.viewer !== this.viewerId || answer.at !== asking.at) return;
    this.asking = null;
    setShared(ANSWER, null);
    asking.then(answer.choice, cx, answer);
  },

  // In the dialog's copy.
  answer(choice) {
    if (this.answered) return;
    this.answered = true;
    const { viewer, at } = this.askFor;
    setShared(ANSWER, { viewer, at, choice });
    closeOverlay(props().overlay);
  },

  askView() {
    const { kind, name } = this.askFor;
    const question = QUESTIONS[kind](name);
    // The report is the dialog's own box, which openOverlay sized to the confirmation's height.
    return div()
      .size_full()
      .on_size_change((s) =>
        setShared("awsome-viewer.rendered", { scope: kind, width: Math.round(s.width), height: Math.round(s.height), expected: { width: CONFIRM.width, height: confirmHeight(question) }, at: Date.now() }),
      )
      .track_focus(this.askFocus)
      .on_key_down((e, cx) => {
        if (confirmKey(e.key, () => this.answer("yes"), () => this.answer("cancel"))) cx.stop_propagation();
      })
      .child(
        confirmView({
          id: "viewer-ask",
          ...question,
          mono: codeFont(),
          onConfirm: () => this.answer("yes"),
          onCancel: () => this.answer("cancel"),
          other: kind === "unsaved" ? { label: "Don’t save", danger: true, onClick: () => this.answer("other") } : null,
        }),
      );
  },
};

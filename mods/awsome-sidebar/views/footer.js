// The sidebar's last line: Settings, Mod settings and Add machine as icons. Herdr's
// own footer gives each a labelled row, which costs twice the height. Mod settings
// opens Better Config, and shows only when that mod is installed.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, updates, readTextFile, appHome, window } from "herdr";
import { keyFor } from "../menu.js"; // shared awsome-* menu helpers (identical copies in each mod)

// A button's tooltip, with its key when one is bound (docs/REQUIREMENTS.md 2.5).
const withKey = (label, action) => {
  const k = keyFor(action, window()?.platform === "macos");
  return k ? `${label} (${k})` : label;
};
import { Icon, SIZE } from "./ui.js";

export class Footer {
  init(_given, cx) {
    this.hasConfig = false;
    // shortcut: checked once, so installing Better Config shows the button after the next reload.
    readTextFile(`${appHome()}/mods/awsome-config/mod.json`)
      .then((raw) => {
        this.hasConfig = raw !== null;
        cx?.notify();
      })
      .catch(() => {});
  }

  button(id, label, action, t, icons) {
    return h_flex()
      .id(id)
      .h(SIZE.icon)
      .px(6)
      .gap(3)
      .flex_none()
      .items_center()
      .rounded(6)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .accessibility_label(label)
      .tooltip(label)
      .on_click(action)
      .children(icons);
  }

  render() {
    const t = theme();
    const updateDot = updates().app.ready ? [div().size(6).rounded_full().bg(t.accent)] : [];
    return h_flex()
      .id("sidebar-footer")
      .size_full()
      .px(8)
      .gap(2)
      .items_center()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .child(
        this.button("settings", withKey("Settings", "app.settings"), () => run("app.settings"), t, [
          Icon("settings"),
          ...updateDot,
        ]),
      )
      .when(this.hasConfig, (el) =>
        el.child(
          this.button("mod-settings", withKey("Mod settings", "mod.open:awsome-config"), () => run("mod.open", { name: "awsome-config" }), t, [
            Icon("sliders"),
          ]),
        ),
      )
      // The gap that puts Add machine at the right end of the line.
      .child(div().flex_1())
      .child(
        this.button("machine", withKey("Add machine", "mod.open:machine-add"), () => run("mod.open", { name: "machine-add" }), t, [
          Icon("plus", 12),
          Icon("server"),
        ]),
      );
  }
}

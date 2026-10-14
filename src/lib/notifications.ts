import {
  isPermissionGranted,
  onAction,
  registerActionTypes,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { api } from "./api";

/// Action type attached to update notifications so the toast carries a button.
const UPDATE_ACTION_TYPE = "trace-update";
/// Id of the toast button that opens the update page.
const OPEN_UPDATE_ACTION = "open-update";

let ready: Promise<void> | null = null;

/// Registers the toast button and its click handler once per session. Desktop
/// shows a notification's actions only while a listener exists, so this must run
/// before any update notification is sent.
export function initNotifications(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await registerActionTypes([
      {
        id: UPDATE_ACTION_TYPE,
        actions: [{ id: OPEN_UPDATE_ACTION, title: "Update" }],
      },
    ]);
    await onAction((event) => {
      // The button, or a click anywhere on the toast, opens the update page.
      if (event.actionId === OPEN_UPDATE_ACTION || event.actionId === "tap") {
        api.showUpdatePage().catch(() => {});
      }
    });
  })().catch(() => {});
  return ready;
}

/// Announces a new version with a native toast that links to the update page.
export async function notifyUpdateAvailable(version: string) {
  let granted = await isPermissionGranted().catch(() => false);
  if (!granted) {
    granted = (await requestPermission().catch(() => "denied")) === "granted";
  }
  if (!granted) return;

  sendNotification({
    title: "Trace",
    body: `New update available, v${version}`,
    actionTypeId: UPDATE_ACTION_TYPE,
  });
}

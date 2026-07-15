export const EN_APPLICATIONS_MESSAGES = {
  "apps.tab.installed": "Installed",
  "apps.tab.leftover": "Leftover Data",
  "apps.tab.registry": "Registry Cleanup",
  "apps.action.refresh": "Refresh",
  "main.apps.confirm.move_title": "Move App to Trash",
  "main.apps.confirm.uninstall_title": "Uninstall App",
  "apps.page.title": "Apps",
  "apps.action.open_system_settings": "Open System Settings",
  "apps.platform.all": "All Platforms",
  "apps.confidence.all": "All Confidence",
  "apps.search.installed_placeholder": "Search installed apps",
  "apps.search.leftover_placeholder": "Search leftover data",
  "apps.search.registry_placeholder": "Search registry cleanup entries",
  "apps.description.registry":
    "Windows only. This tab only shows stale uninstall registry entries whose install path and uninstaller are both no longer valid.",
  "apps.error.load_registry":
    "Unable to load leftover uninstall registry entries.",
  "apps.error.remove_registry":
    "Unable to remove leftover uninstall registry entries.",
  "apps.toast.registry_all":
    "Removed {count} uninstall registry entrie(s).",
  "apps.toast.registry_partial":
    "Removed {deletedCount} uninstall registry entrie(s), {failedCount} failed",
  "apps.empty.registry":
    "No leftover uninstall registry entries were found.",
  "apps.empty.registry_detail":
    "This is normal when Windows has no stale uninstall registry entries left to clean up.",
  "apps.helper.registry":
    "These are uninstall registry entries whose install path and uninstaller are both no longer valid. Removing them only clears the leftover uninstall registration.",
  "apps.action.remove_selected_registry": "Remove Selected Registry Entries",
  "apps.registry.path": "Registry Path",
  "apps.registry.install_missing": "Install path missing",
  "apps.registry.uninstaller_missing": "Uninstaller missing",
  "apps.registry.install_unavailable": "Install path unavailable",
  "apps.registry.uninstall_unavailable": "Uninstall command unavailable",
  "apps.related.title": "Related Data",
  "apps.action.hide_data": "Hide Data",
  "main.apps.confirm.action_move_to_trash": "Move to Trash",
  "main.apps.confirm.action_uninstall": "Uninstall",
  "apps.action.working": "Working...",
  "apps.error.load_installed":
    "Unable to load the installed app list.",
  "apps.error.invalid_app_id": "Invalid app ID.",
  "main.apps.error.no_install_path":
    "Unable to open the install location.",
  "apps.error.open_system_settings":
    "Unable to open the system uninstall settings.",
  "apps.error.load_related": "Unable to load related data.",
  "apps.error.load_leftover": "Unable to load leftover app data.",
  "apps.error.invalid_item_ids": "Invalid item ID list.",
  "apps.error.remove_leftover":
    "Unable to move leftover app data to the trash.",
  "main.apps.error.not_found":
    "Unable to find installed app information.",
  "main.apps.error.protected": "Protected items cannot be removed.",
  "main.apps.confirm.move_detail":
    "The app bundle will be moved to the trash.",
  "main.apps.confirm.uninstall_detail":
    "The registered uninstaller will be launched. The rest of the flow continues outside the app.",
  "main.apps.message.opened_system_settings":
    "Opened the system uninstall settings.",
  "main.apps.confirm.related_detail":
    "Selected related data will also be moved to the trash.",
  "main.apps.confirm.message": 'Do you want to {action} "{name}"?',
  "apps.error.uninstall_start":
    "Unable to start uninstalling the app.",
  "apps.related.empty":
    "No related data paths were detected.",
  "apps.action.move_selected_to_trash": "Move Selected to Trash",
  "apps.toast.leftover_partial":
    "Moved {deletedCount} leftover item(s), {failedCount} failed.",
  "main.apps.leftover.mac.default_reason":
    "This item is in a standard {label} path, but it is only a name-based candidate.",
  "main.apps.leftover.mac.support_reason":
    "This item is in a standard {label} path but was matched against installed apps by name only.",
  "main.apps.leftover.mac.container_reason":
    "This item is in a standard macOS {label} path and does not match any installed app bundle.",
  "main.apps.error.no_app_path":
    "Unable to find the app path to delete.",
  "main.apps.error.no_uninstall_command":
    "There is no executable uninstall command.",
  "main.apps.message.with_related_all":
    "{baseMessage} Also moved {deletedCount} related data item(s) to the trash.",
  "main.apps.message.with_related_partial":
    "{baseMessage} Moved {deletedCount} related data item(s), but failed to move {failedCount}.",
  "main.apps.message.moved_to_trash": "Moved the app to the trash.",
  "main.apps.message.started_uninstaller": "Started the uninstaller.",
  "apps.description.installed":
    "On macOS, the app bundle is moved to the trash. On Windows, the registered uninstaller is launched. You can also select related data from the expanded item.",
  "apps.description.leftover":
    "Even if the main app is gone, you can still review and clean up leftover related data candidates.",
  "apps.empty.installed": "No installed apps to show.",
  "apps.empty.leftover": "No leftover app data to show.",
  "apps.sort.priority": "Priority order",
  "apps.sort.name": "Name order",
  "apps.sort.size": "Largest size first",
  "apps.helper.installed":
    "You can manage installed apps directly, or expand each app to move related data to the trash together.",
  "apps.helper.leftover":
    "These are leftover data candidates not linked to an installed app. Review each card's rationale and risk before selecting them.",
  "apps.status.leftover_sizes_loading":
    "Calculating folder sizes: {ready}/{total} ready, {remaining} remaining",
  "apps.status.leftover_sizes_ready":
    "Folder sizes loaded for all {count} items",
  "apps.danger.installed":
    "App removal affects the selected app immediately. On Windows this may launch the app's own uninstaller, and selected related data can be removed together.",
  "apps.danger.leftover":
    "Leftover cleanup moves the selected folders to the trash. Review the path and risk note before removing anything you may still need.",
  "apps.danger.registry":
    "Registry cleanup deletes stale uninstall entries only. Keep it as the final step after checking the install path and uninstall command.",
  "apps.related.description":
    "Only the selected paths will be moved to the trash along with app removal.",
  "apps.selection.leftover_summary":
    "Selected: high {high} / medium {medium} / low {low}",
  "apps.registry.warning":
    "Registry cleanup only removes stale uninstall entries. Keep it for the final cleanup step.",
  "apps.related.loading": "Loading related data candidates...",
  "main.apps.error.unsupported_os":
    "This operating system is not supported.",
  "main.apps.protected.current_app":
    "You cannot remove the currently running SystemScope app.",
  "main.apps.protected.system_app":
    "You cannot remove a system app or the currently running app.",
  "main.apps.leftover.mac.container_risk":
    "It is often safe to remove if you no longer use the app, but login state or sandboxed data may be lost.",
  "main.apps.leftover.mac.pref_bundle_reason":
    "This is a bundle ID style preferences file and does not match any installed app.",
  "main.apps.leftover.mac.pref_name_reason":
    "This is a preferences file inferred only by name.",
  "main.apps.leftover.mac.pref_risk":
    "It probably only removes settings, but those settings may not be recoverable after reinstalling the app.",
  "main.apps.leftover.mac.support_risk":
    "It may contain app data, downloads, or internal databases, so review the path before deleting.",
  "main.apps.leftover.mac.default_risk":
    "It is likely cache or log data, but some reusable app data may be mixed in.",
  "main.apps.leftover.win.programdata_reason":
    "This item is in the shared program data path and does not match any installed program.",
  "main.apps.leftover.win.programdata_risk":
    "Shared settings or service data may remain, so review it before deleting.",
  "main.apps.leftover.win.local_programs_reason":
    "This item is in the user local programs path but does not match any installed app.",
  "main.apps.leftover.win.local_programs_risk":
    "It is often safe to remove if you no longer use the app, but it could also be a portable app.",
  "main.apps.leftover.win.default_reason":
    "This item is in the standard {label} path but was compared only by name against the install list.",
  "main.apps.leftover.win.default_risk":
    "It may be cache or settings data, but some apps keep reusable data here for reinstalls.",
  "apps.badge.protected": "Protected",
  "apps.table.version": "Version",
  "apps.table.publisher": "Publisher",
  "apps.table.platform": "Platform",
  "apps.table.location": "Location",
  "apps.table.actions": "Actions",
  "apps.count.installed_summary": "{count} installed apps",
  "apps.reason.why": "Why:",
  "apps.reason.risk": "Risk:",
  "apps.confidence.high": "High confidence",
  "apps.confidence.medium": "Medium confidence",
  "apps.confidence.low": "Low confidence",
  "apps.action.move_to_trash": "Move to Trash",
  "apps.action.open": "Open",
  "apps.action.related_data": "Related Data",
  "apps.action.uninstall": "Uninstall",
  "apps.error.open_location": "Unable to open the install location.",
  "apps.error.open_path": "Unable to open the folder.",
  "apps.registry.install_location": "Install Location",
  "apps.registry.uninstall_command": "Uninstall Command",
  "apps.search.label": "Search",
  "apps.table.name": "Name",
  "apps.toast.leftover_restore_hint": "Items can be restored from Trash.",
  "apps.toast.removed": "Moved the app to the trash.",
  "apps.toast.removed_restore_hint": "The app can be restored from Trash.",
  "apps.toast.uninstaller_started": "Started the uninstaller.",
  "Details": "Details",
  "apps.toast.leftover_all": "Moved {count} leftover item(s) to the trash.",
  "main.apps.confirm.related_count": "Related Data: {count} item(s)",
} as const

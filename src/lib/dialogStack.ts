const openDialogIds: string[] = [];

export function pushDialog(id: string): void {
  const existingIndex = openDialogIds.indexOf(id);
  if (existingIndex !== -1) {
    openDialogIds.splice(existingIndex, 1);
  }
  openDialogIds.push(id);
}

export function removeDialog(id: string): void {
  const existingIndex = openDialogIds.indexOf(id);
  if (existingIndex !== -1) {
    openDialogIds.splice(existingIndex, 1);
  }
}

export function isTopmostDialog(id: string): boolean {
  return openDialogIds.length > 0 && openDialogIds[openDialogIds.length - 1] === id;
}

export function hasOpenDialogs(): boolean {
  return openDialogIds.length > 0;
}

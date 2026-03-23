let applyingRemote = false;

export function setWorkspaceSyncApplyingRemote(value: boolean): void {
  applyingRemote = value;
}

export function isWorkspaceSyncApplyingRemote(): boolean {
  return applyingRemote;
}

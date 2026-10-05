export interface ReleaseNoteVersion {
	version: string;
	content: string;
	date: string | null;
	isCurrent: boolean;
}

export const CURRENT_VERSION = "0.1.0";
export const RELEASE_NOTES_BUNDLE: ReleaseNoteVersion[] = [];

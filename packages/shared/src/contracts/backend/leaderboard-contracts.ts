export interface LeaderboardEntry {
	rank: number;
	score: number;
	clearedFloor: number;
	accuracy: number | null;
	finalizedAt: string;
}

export interface LeaderboardResponse {
	entries: LeaderboardEntry[];
}

export type EventStatus = 'draft' | 'live' | 'ended';

export type AdminEvent = {
  id: string;
  title: string;
  status: EventStatus;
  hlsPath: string | null;
  streamKey: string;
  redeemCount: number;
  totalCodes: number;
  activeViewers: number;
  createdAt: string;
  updatedAt: string;
};

export type RedeemResponse = {
  eventId: string;
  sessionId: string;
  status: EventStatus;
};

export type StreamResponse = {
  playbackUrl: string | null;
  eventStatus: 'live' | 'not_started' | 'ended';
};

export type BulkCodeResponse = {
  eventId: string;
  requested: number;
  created: number;
  oneTime: boolean;
  maxUses: number;
  expiresAt: string | null;
  codes: string[];
  csvUrl: string;
};

/**
 * 歌曲匹配信息与解锁结果类型
 * @author Hackerdallas
 */
export type SongMatchInfo = {
  keyword: string;
  songName: string;
  artist: string;
};

export type SongUrlResult = {
  code: number;
  url: string | null;
};

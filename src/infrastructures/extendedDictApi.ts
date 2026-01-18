/**
 * 拡張辞書API
 * イントネーション辞書サーバー（FastAPI）との通信
 */

export interface ExtendedDictEntry {
  word: string;
  pronunciation: string;
  accent_type: number;
  mora_count: number;
  pitch_values: number[];
  length_values: number[];
  speaker_id?: number;
}

export interface ExtendedDictResponse {
  entries: ExtendedDictEntry[];
  total: number;
}

export interface SynthesizeDebugResponse {
  original_text: string;
  original_query: AudioQueryForDict;
  modified_query: AudioQueryForDict;
  applied_entries: ExtendedDictEntry[];
}

export interface AudioQueryForDict {
  accent_phrases: AccentPhraseForDict[];
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  outputSamplingRate: number;
  outputStereo: boolean;
}

export interface AccentPhraseForDict {
  moras: MoraForDict[];
  accent: number;
  pause_mora?: MoraForDict;
}

export interface MoraForDict {
  text: string;
  consonant?: string;
  consonant_length?: number;
  vowel: string;
  vowel_length: number;
  pitch: number;
}

// Windows では localhost が IPv6 (::1) に解決される場合があり、接続が遅くなる可能性があるため
// 明示的に IPv4 アドレスを使用
const EXTENDED_DICT_API_BASE = "http://127.0.0.1:8000/api/v1";

// サーバー接続タイムアウト（ミリ秒）
// サーバーが起動していない場合に素早くフォールバックするため短めに設定
// CI環境などでサーバーが存在しない場合、接続拒否は通常即座に返るが、
// タイムアウトの可能性を考慮して100msに設定
const FETCH_TIMEOUT_MS = 100;

/**
 * タイムアウト付きfetchを実行するヘルパー関数
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const extendedDictApi = {
  /**
   * 辞書一覧を取得
   */
  async getAll(): Promise<ExtendedDictResponse> {
    const response = await fetch(`${EXTENDED_DICT_API_BASE}/dictionary/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch dictionary: ${response.statusText}`);
    }
    return (await response.json()) as ExtendedDictResponse;
  },

  /**
   * 辞書エントリを登録（upsert）
   */
  async create(entry: ExtendedDictEntry): Promise<{ message: string }> {
    const response = await fetch(`${EXTENDED_DICT_API_BASE}/dictionary/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      throw new Error(`Failed to create entry: ${response.statusText}`);
    }
    return (await response.json()) as { message: string };
  },

  /**
   * 辞書エントリを削除
   */
  async delete(word: string): Promise<{ message: string }> {
    const response = await fetch(
      `${EXTENDED_DICT_API_BASE}/dictionary/${encodeURIComponent(word)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Failed to delete entry: ${response.statusText}`);
    }
    return (await response.json()) as { message: string };
  },

  /**
   * デバッグ用合成（AudioQueryを取得）
   */
  async synthesizeDebug(
    text: string,
    speaker: number = 1,
  ): Promise<SynthesizeDebugResponse> {
    const response = await fetch(`${EXTENDED_DICT_API_BASE}/synthesize/debug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    });
    if (!response.ok) {
      throw new Error(`Failed to synthesize: ${response.statusText}`);
    }
    return (await response.json()) as SynthesizeDebugResponse;
  },

  /**
   * プレビュー合成（WAVデータを返す）
   */
  async synthesizePreview(
    audioQuery: AudioQueryForDict,
    speaker: number = 1,
  ): Promise<ArrayBuffer> {
    const response = await fetch(
      `${EXTENDED_DICT_API_BASE}/synthesize/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_query: audioQuery, speaker }),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to preview: ${response.statusText}`);
    }
    return response.arrayBuffer();
  },

  /**
   * AudioQueryに拡張辞書を適用（メイン合成フロー用）
   *
   * @param audioQuery - VOICEVOX Engine から取得した AudioQuery
   * @param text - 元の入力テキスト（マッチング用）
   * @param speaker - 話者ID
   * @returns 辞書適用後の AudioQuery（サーバーが落ちている場合は元のまま）
   */
  async applyDictionary(
    audioQuery: AudioQueryForDict,
    text: string,
    speaker: number = 1,
  ): Promise<{
    audio_query: AudioQueryForDict;
    matches_found: number;
    applied_entries: string[];
  }> {
    try {
      const response = await fetchWithTimeout(
        `${EXTENDED_DICT_API_BASE}/synthesize/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio_query: audioQuery, text, speaker }),
        },
      );
      if (!response.ok) {
        console.warn(
          `Extended dictionary apply failed: ${response.statusText}, using original query`,
        );
        return {
          audio_query: audioQuery,
          matches_found: 0,
          applied_entries: [],
        };
      }
      return (await response.json()) as {
        audio_query: AudioQueryForDict;
        matches_found: number;
        applied_entries: string[];
      };
    } catch (e) {
      // サーバーが落ちている場合は元のAudioQueryを返す
      console.warn("Extended dictionary server not available:", e);
      return {
        audio_query: audioQuery,
        matches_found: 0,
        applied_entries: [],
      };
    }
  },
};

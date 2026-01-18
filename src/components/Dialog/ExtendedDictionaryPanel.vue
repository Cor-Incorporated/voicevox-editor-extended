<template>
  <div class="extended-dictionary-panel row">
    <!-- 左側：単語一覧 -->
    <div class="col-4 word-list-col">
      <div class="word-list-header">
        <div class="row word-list-title">
          <span class="text-h5 col-8">単語一覧</span>
          <QBtn
            outline
            textColor="display"
            class="text-no-wrap text-bold col"
            :disable="loading"
            @click="newEntry"
          >
            追加
          </QBtn>
        </div>
      </div>
      <QList class="word-list">
        <QItem
          v-for="entry in entries"
          :key="entry.word"
          v-ripple
          clickable
          :active="selectedWord === entry.word"
          activeClass="active-word"
          @click="selectEntry(entry)"
        >
          <QItemSection>
            <QItemLabel class="text-display">{{ entry.word }}</QItemLabel>
            <QItemLabel caption>{{ entry.pronunciation }}</QItemLabel>
          </QItemSection>
          <QItemSection side>
            <QBtn
              size="12px"
              flat
              dense
              round
              icon="delete_outline"
              @click.stop="deleteEntry(entry.word)"
            >
              <QTooltip :delay="500">削除</QTooltip>
            </QBtn>
          </QItemSection>
        </QItem>
      </QList>
    </div>

    <!-- 右側：編集エリア -->
    <div class="col-8 edit-area q-pa-md">
      <div v-if="!editing" class="no-selection">
        単語を選択するか、「追加」ボタンを押してください
      </div>
      <div v-else class="edit-form">
        <div class="form-group">
          <label>単語</label>
          <QInput
            v-model="editForm.word"
            outlined
            dense
            :disable="isEditMode"
            placeholder="例: ずんだもん"
          />
        </div>

        <div class="form-group">
          <label>発音（カタカナ）</label>
          <div class="row q-gutter-sm">
            <QInput
              v-model="editForm.pronunciation"
              outlined
              dense
              class="col"
              placeholder="例: ズンダモン"
            />
            <QBtn
              outline
              :disable="!editForm.word || loading"
              @click="fetchPronunciation"
            >
              発音取得
            </QBtn>
          </div>
        </div>

        <!-- ピッチ曲線エディタ -->
        <div v-if="moras.length > 0" class="form-group">
          <label>ピッチ調整</label>
          <div class="pitch-editor">
            <canvas
              ref="pitchCanvas"
              :width="canvasWidth"
              :height="200"
              @mousedown="onCanvasMouseDown"
              @mousemove="onCanvasMouseMove"
              @mouseup="onCanvasMouseUp"
              @mouseleave="onCanvasMouseUp"
            />
          </div>
        </div>

        <!-- モーラ別スライダー -->
        <div v-if="moras.length > 0" class="form-group">
          <label>モーラ別調整</label>
          <div class="mora-grid">
            <div v-for="(mora, index) in moras" :key="index" class="mora-item">
              <div class="mora-text">{{ mora.text }}</div>
              <div class="slider-group">
                <span class="slider-label">
                  音高: {{ editForm.pitch_values[index]?.toFixed(2) }}
                </span>
                <QSlider
                  v-model="editForm.pitch_values[index]"
                  :min="3"
                  :max="7"
                  :step="0.01"
                  color="primary"
                  @update:modelValue="drawPitchCurve"
                />
              </div>
              <div class="slider-group">
                <span class="slider-label">
                  長さ: {{ editForm.length_values[index]?.toFixed(2) }}
                </span>
                <QSlider
                  v-model="editForm.length_values[index]"
                  :min="0.01"
                  :max="0.5"
                  :step="0.01"
                  color="secondary"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 話者選択 -->
        <div class="form-group">
          <label>プレビュー話者</label>
          <div class="row items-center q-gutter-sm">
            <CharacterButton
              :characterInfos
              :selectedVoice
              :uiLocked="loading"
              @update:selectedVoice="selectedVoice = $event"
            />
            <span v-if="selectedVoice" class="text-display">
              {{ getSelectedCharacterName() }}
            </span>
          </div>
        </div>

        <!-- プレビュー再生 -->
        <div v-if="moras.length > 0" class="form-group">
          <QBtn
            outline
            icon="play_arrow"
            :loading="previewing"
            @click="playPreview"
          >
            プレビュー再生
          </QBtn>
        </div>

        <!-- 保存ボタン -->
        <div class="form-actions">
          <QBtn color="primary" :loading :disable="!canSave" @click="saveEntry">
            保存
          </QBtn>
          <QBtn outline @click="cancelEdit">キャンセル</QBtn>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import {
  extendedDictApi,
  type ExtendedDictEntry,
  type MoraForDict,
  type AudioQueryForDict,
} from "@/infrastructures/extendedDictApi";
import { useStore } from "@/store";
import CharacterButton from "@/components/CharacterButton.vue";
import { Voice } from "@/type/preload";

const store = useStore();

const entries = ref<ExtendedDictEntry[]>([]);
const selectedWord = ref<string | null>(null);
const editing = ref(false);
const isEditMode = ref(false);
const loading = ref(false);
const previewing = ref(false);
const error = ref<string | null>(null);
const moras = ref<MoraForDict[]>([]);
const baseAudioQuery = ref<AudioQueryForDict | null>(null);
const pitchCanvas = ref<HTMLCanvasElement | null>(null);
const draggingIndex = ref<number | null>(null);

// 元のピッチ値（VOICEVOXから取得した絶対値、通常3〜7程度）
const basePitchValues = ref<number[]>([]);
// 元の長さ値（VOICEVOXから取得した絶対値）
const baseLengthValues = ref<number[]>([]);

// 話者選択
const selectedVoice = ref<Voice | undefined>(undefined);
const characterInfos = computed(() => {
  return store.getters.USER_ORDERED_CHARACTER_INFOS("talk") ?? [];
});

// 選択中のスタイルID（VOICEVOX APIで使用）
const currentStyleId = computed(() => {
  return selectedVoice.value?.styleId ?? 1;
});

// pitch_values と length_values は絶対値として扱う
const editForm = ref({
  word: "",
  pronunciation: "",
  pitch_values: [] as number[], // 絶対値: VOICEVOXの値（通常3〜7程度）
  length_values: [] as number[], // 絶対値: VOICEVOXの値（通常0.05〜0.5程度）
});

const canvasWidth = computed(() => Math.max(400, moras.value.length * 80));

const canSave = computed(
  () =>
    editForm.value.word.trim() &&
    editForm.value.pronunciation.trim() &&
    editForm.value.pitch_values.length > 0,
);

// パネルがマウントされたら辞書を読み込む＆デフォルト話者を設定
onMounted(async () => {
  await loadDictionary();
  // デフォルトの話者を設定
  if (!selectedVoice.value && characterInfos.value.length > 0) {
    const firstChar = characterInfos.value[0].metas;
    const firstStyle = firstChar.styles[0];
    selectedVoice.value = {
      engineId: firstStyle.engineId,
      speakerId: firstChar.speakerUuid,
      styleId: firstStyle.styleId,
    };
  }
});

// 話者が変更されたら、編集中のエントリのAudioQueryを再取得
watch(selectedVoice, async (newVoice) => {
  if (!newVoice || !editing.value || !editForm.value.word.trim()) return;
  try {
    const result = await extendedDictApi.synthesizeDebug(
      editForm.value.word,
      currentStyleId.value,
    );
    baseAudioQuery.value = result.modified_query;
  } catch (e) {
    console.warn("Failed to refresh AudioQuery after speaker change:", e);
  }
});

async function loadDictionary() {
  loading.value = true;
  error.value = null;
  try {
    const response = await extendedDictApi.getAll();
    entries.value = response.entries;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "辞書の読み込みに失敗";
  } finally {
    loading.value = false;
  }
}

async function selectEntry(entry: ExtendedDictEntry) {
  selectedWord.value = entry.word;
  isEditMode.value = true;
  editing.value = true;

  // 保存されている絶対値をそのまま設定
  editForm.value = {
    word: entry.word,
    pronunciation: entry.pronunciation,
    pitch_values: [...entry.pitch_values],
    length_values: [...entry.length_values],
  };

  // モーラを発音から生成
  moras.value = splitIntoMoras(entry.pronunciation).map((text, i) => ({
    text,
    vowel: "a",
    vowel_length: entry.length_values[i] || 0.1,
    pitch: entry.pitch_values[i] || 5.0,
  }));

  // 基準値として保存
  basePitchValues.value = [...entry.pitch_values];
  baseLengthValues.value = [...entry.length_values];

  // プレビュー用にAudioQueryを取得
  try {
    const result = await extendedDictApi.synthesizeDebug(
      entry.word,
      currentStyleId.value,
    );
    baseAudioQuery.value = result.modified_query;
  } catch (e) {
    console.warn("Failed to fetch AudioQuery for preview:", e);
  }

  void nextTick(() => drawPitchCurve());
}

function newEntry() {
  selectedWord.value = null;
  isEditMode.value = false;
  editing.value = true;
  editForm.value = {
    word: "",
    pronunciation: "",
    pitch_values: [],
    length_values: [],
  };
  moras.value = [];
  baseAudioQuery.value = null;
  basePitchValues.value = [];
  baseLengthValues.value = [];
}

function cancelEdit() {
  editing.value = false;
  selectedWord.value = null;
  moras.value = [];
  basePitchValues.value = [];
  baseLengthValues.value = [];
}

// 変更があるかチェック
function hasUnsavedChanges(): boolean {
  // 既存エントリ編集時は保存された値と比較
  if (isEditMode.value && selectedWord.value) {
    const entry = entries.value.find((e) => e.word === selectedWord.value);
    if (entry) {
      // pitch_values または length_values が変更されているかチェック
      const pitchChanged = editForm.value.pitch_values.some(
        (v, i) => Math.abs(v - entry.pitch_values[i]) > 0.001,
      );
      const lengthChanged = editForm.value.length_values.some(
        (v, i) => Math.abs(v - entry.length_values[i]) > 0.001,
      );
      return pitchChanged || lengthChanged;
    }
  }
  // 新規作成時は値があれば変更ありとみなす
  return editForm.value.pitch_values.length > 0;
}

async function fetchPronunciation() {
  if (!editForm.value.word.trim()) return;

  // 変更がある場合は確認ダイアログを表示
  if (hasUnsavedChanges()) {
    const confirmed = confirm(
      "発音を再取得すると、現在の音高・長さの調整はリセットされます。\n続行しますか？",
    );
    if (!confirmed) return;
  }

  loading.value = true;
  error.value = null;
  try {
    const result = await extendedDictApi.synthesizeDebug(
      editForm.value.word,
      currentStyleId.value,
    );
    const query = result.modified_query;
    baseAudioQuery.value = query;

    // モーラを抽出
    const allMoras: MoraForDict[] = [];
    for (const phrase of query.accent_phrases) {
      allMoras.push(...phrase.moras);
    }
    moras.value = allMoras;

    // 元のピッチ/長さを保存（VOICEVOXの絶対値）
    basePitchValues.value = allMoras.map((m) => m.pitch);
    baseLengthValues.value = allMoras.map((m) => m.vowel_length);

    // 発音を設定、VOICEVOXのデフォルト値（絶対値）をセット
    editForm.value.pronunciation = allMoras.map((m) => m.text).join("");
    editForm.value.pitch_values = allMoras.map((m) => m.pitch);
    editForm.value.length_values = allMoras.map((m) => m.vowel_length);

    void nextTick(() => drawPitchCurve());
  } catch (e) {
    error.value = e instanceof Error ? e.message : "発音の取得に失敗";
  } finally {
    loading.value = false;
  }
}

async function saveEntry() {
  if (!canSave.value) return;

  const word = editForm.value.word.trim();

  // 新規作成時に同じ単語が既に存在する場合はエラー
  if (!isEditMode.value) {
    const existingEntry = entries.value.find((e) => e.word === word);
    if (existingEntry) {
      error.value = `「${word}」は既に登録されています。同じ単語を複数登録することはできません。`;
      return;
    }
  }

  loading.value = true;
  error.value = null;
  try {
    // 絶対値をそのまま保存
    const entry: ExtendedDictEntry = {
      word,
      pronunciation: editForm.value.pronunciation.trim(),
      accent_type: 0,
      mora_count: editForm.value.pitch_values.length,
      pitch_values: editForm.value.pitch_values.map(
        (v) => Math.round(v * 100) / 100,
      ),
      length_values: editForm.value.length_values.map((v) =>
        Math.max(0.01, Math.round(v * 100) / 100),
      ),
      speaker_id: currentStyleId.value,
    };
    await extendedDictApi.create(entry);
    await loadDictionary();
    cancelEdit();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "保存に失敗";
  } finally {
    loading.value = false;
  }
}

async function deleteEntry(word: string) {
  if (!confirm(`「${word}」を削除しますか？`)) return;

  loading.value = true;
  try {
    await extendedDictApi.delete(word);
    await loadDictionary();
    if (selectedWord.value === word) {
      cancelEdit();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "削除に失敗";
  } finally {
    loading.value = false;
  }
}

async function playPreview() {
  if (!baseAudioQuery.value || editForm.value.pitch_values.length === 0) return;

  previewing.value = true;
  try {
    // AudioQueryのコピーを作成し、絶対値で上書き
    const modified = JSON.parse(
      JSON.stringify(baseAudioQuery.value),
    ) as AudioQueryForDict;
    let moraIndex = 0;
    for (const phrase of modified.accent_phrases) {
      for (const mora of phrase.moras) {
        if (moraIndex < editForm.value.pitch_values.length) {
          mora.pitch = editForm.value.pitch_values[moraIndex];
        }
        if (moraIndex < editForm.value.length_values.length) {
          mora.vowel_length = editForm.value.length_values[moraIndex];
        }
        moraIndex++;
      }
    }

    const audioData = await extendedDictApi.synthesizePreview(
      modified,
      currentStyleId.value,
    );
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(audioData);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "再生に失敗";
  } finally {
    previewing.value = false;
  }
}

// 選択中のキャラクター名を取得
function getSelectedCharacterName(): string {
  if (!selectedVoice.value) return "";
  for (const charInfo of characterInfos.value) {
    if (charInfo.metas.speakerUuid === selectedVoice.value.speakerId) {
      const style = charInfo.metas.styles.find(
        (s) => s.styleId === selectedVoice.value?.styleId,
      );
      if (style?.styleName) {
        return `${charInfo.metas.speakerName}（${style.styleName}）`;
      }
      return charInfo.metas.speakerName;
    }
  }
  return "";
}

// ピッチ範囲定数（VOICEVOXの絶対値範囲）
const PITCH_MIN = 3;
const PITCH_MAX = 7;
const PITCH_RANGE = PITCH_MAX - PITCH_MIN;

// ピッチ曲線描画
function drawPitchCurve() {
  const canvas = pitchCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;

  ctx.clearRect(0, 0, width, height);

  // グリッド（5本: 3, 4, 5, 6, 7）
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = height - padding - (i / 4) * (height - padding * 2);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Y軸ラベル
  ctx.fillStyle = "#888";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  const labels = [3, 4, 5, 6, 7];
  labels.forEach((val, i) => {
    const y = height - padding - (i / 4) * (height - padding * 2);
    ctx.fillText(val.toFixed(1), padding - 5, y + 3);
  });

  // モーララベル
  ctx.textAlign = "center";
  ctx.fillStyle = "#4a9eff";
  moras.value.forEach((mora, index) => {
    const x = getPointX(index, width, padding);
    ctx.fillText(mora.text, x, height - 10);
  });

  if (editForm.value.pitch_values.length === 0) return;

  // ピッチ曲線
  ctx.strokeStyle = "#4a9eff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  editForm.value.pitch_values.forEach((pitch, i) => {
    const x = getPointX(i, width, padding);
    const y = getPointY(pitch, height, padding);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevX = getPointX(i - 1, width, padding);
      const prevY = getPointY(
        editForm.value.pitch_values[i - 1],
        height,
        padding,
      );
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
  });
  ctx.stroke();

  // 制御点
  editForm.value.pitch_values.forEach((pitch, index) => {
    const x = getPointX(index, width, padding);
    const y = getPointY(pitch, height, padding);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = draggingIndex.value === index ? "#ffa500" : "#4a9eff";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function getPointX(index: number, width: number, padding: number): number {
  if (moras.value.length <= 1) return width / 2;
  const step = (width - padding * 2) / (moras.value.length - 1);
  return padding + index * step;
}

function getPointY(pitch: number, height: number, padding: number): number {
  // pitch を -0.15〜0.15 の範囲から 0〜1 に正規化してキャンバス座標に変換
  const normalized = (pitch - PITCH_MIN) / PITCH_RANGE;
  return height - padding - normalized * (height - padding * 2);
}

function getPointIndexAtPosition(x: number, y: number): number | null {
  const canvas = pitchCanvas.value;
  if (!canvas) return null;

  const padding = 40;
  for (let i = 0; i < editForm.value.pitch_values.length; i++) {
    const px = getPointX(i, canvas.width, padding);
    const py = getPointY(
      editForm.value.pitch_values[i],
      canvas.height,
      padding,
    );
    const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
    if (distance <= 12) return i;
  }
  return null;
}

function onCanvasMouseDown(e: MouseEvent) {
  const canvas = pitchCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const index = getPointIndexAtPosition(x, y);
  if (index != null) {
    draggingIndex.value = index;
  }
}

function onCanvasMouseMove(e: MouseEvent) {
  if (draggingIndex.value == null) return;
  const canvas = pitchCanvas.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const padding = 40;
  // キャンバス座標から 0〜1 に正規化し、-0.15〜0.15 の範囲に変換
  const normalized =
    (canvas.height - padding - y) / (canvas.height - padding * 2);
  const pitch = Math.max(
    PITCH_MIN,
    Math.min(PITCH_MAX, PITCH_MIN + normalized * PITCH_RANGE),
  );
  editForm.value.pitch_values[draggingIndex.value] =
    Math.round(pitch * 100) / 100;
  drawPitchCurve();
}

function onCanvasMouseUp() {
  draggingIndex.value = null;
}

// カタカナをモーラ分割
function splitIntoMoras(text: string): string[] {
  const result: string[] = [];
  const smallKana = "ァィゥェォャュョヮ";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (nextChar && smallKana.includes(nextChar)) {
      result.push(char + nextChar);
      i++;
    } else {
      result.push(char);
    }
  }
  return result;
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;

.extended-dictionary-panel {
  height: 100%;
  width: 100%;
}

.word-list-col {
  border-right: solid 1px colors.$surface;
  overflow-x: hidden;
}

.word-list-header {
  margin: 1rem;
  .word-list-title {
    align-items: center;
    gap: 0.5rem;
  }
}

.word-list {
  height: calc(100vh - 200px);
  overflow-y: auto;
}

.active-word {
  background: rgba(colors.$primary-rgb, 0.4);
}

.edit-area {
  overflow-y: auto;
  height: calc(100vh - 150px);
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: colors.$display;
  opacity: 0.5;
}

.form-group {
  margin-bottom: 1.5rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: colors.$display;
  }
}

.pitch-editor {
  background: colors.$background;
  border-radius: 4px;
  padding: 1rem;

  canvas {
    cursor: grab;
    border: 1px solid colors.$surface;
    border-radius: 4px;
  }
}

.mora-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.mora-item {
  background: colors.$surface;
  border-radius: 4px;
  padding: 1rem;
  min-width: 120px;
}

.mora-text {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  margin-bottom: 0.75rem;
  color: colors.$primary;
}

.slider-group {
  margin-bottom: 0.5rem;

  .slider-label {
    font-size: 0.75rem;
    color: colors.$display;
    opacity: 0.7;
  }
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 2rem;
}

.error-message {
  color: colors.$warning;
  margin-top: 1rem;
}
</style>

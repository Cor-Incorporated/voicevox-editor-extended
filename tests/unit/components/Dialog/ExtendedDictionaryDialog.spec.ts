import { mount, flushPromises } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { Quasar } from "quasar";
import ExtendedDictionaryDialog from "@/components/Dialog/ExtendedDictionaryDialog.vue";
import { extendedDictApi } from "@/infrastructures/extendedDictApi";
import type {
  ExtendedDictEntry,
  ExtendedDictResponse,
  SynthesizeDebugResponse,
  AudioQueryForDict,
} from "@/infrastructures/extendedDictApi";

// window.confirm をモック（happy-dom には存在しない）
const originalConfirm = globalThis.confirm;
beforeEach(() => {
  globalThis.confirm = vi.fn(() => true);
});
afterEach(() => {
  globalThis.confirm = originalConfirm;
});

// extendedDictApi をモック
vi.mock("@/infrastructures/extendedDictApi", () => ({
  extendedDictApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    synthesizeDebug: vi.fn(),
    synthesizePreview: vi.fn(),
  },
}));

const mockedApi = vi.mocked(extendedDictApi);

// テスト用のサンプルデータ
const mockEntry: ExtendedDictEntry = {
  word: "テスト",
  pronunciation: "テスト",
  accent_type: 0,
  mora_count: 3,
  pitch_values: [5.5, 5.2, 4.8],
  length_values: [0.1, 0.1, 0.15],
  speaker_id: 1,
};

const mockDictResponse: ExtendedDictResponse = {
  entries: [mockEntry],
  total: 1,
};

const mockAudioQuery: AudioQueryForDict = {
  accent_phrases: [
    {
      moras: [
        { text: "テ", vowel: "e", vowel_length: 0.1, pitch: 5.5 },
        { text: "ス", vowel: "u", vowel_length: 0.1, pitch: 5.2 },
        { text: "ト", vowel: "o", vowel_length: 0.15, pitch: 4.8 },
      ],
      accent: 1,
    },
  ],
  speedScale: 1.0,
  pitchScale: 0.0,
  intonationScale: 1.0,
  volumeScale: 1.0,
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.1,
  outputSamplingRate: 24000,
  outputStereo: false,
};

const mockSynthesizeDebugResponse: SynthesizeDebugResponse = {
  original_text: "テスト",
  original_query: mockAudioQuery,
  modified_query: mockAudioQuery,
  applied_entries: [],
};

// Quasar コンポーネントのスタブ
const stubComponents = {
  QDialog: {
    template: `<div class="q-dialog"><slot /></div>`,
    props: ["modelValue"],
  },
  QLayout: { template: "<div><slot /></div>" },
  QPageContainer: { template: "<div><slot /></div>" },
  QHeader: { template: "<div><slot /></div>" },
  QToolbar: { template: "<div><slot /></div>" },
  QToolbarTitle: { template: "<div><slot /></div>" },
  QSpace: { template: "<span />" },
  QBtn: {
    template:
      '<button :disabled="disable" :data-icon="icon" @click="handleClick($event)"><slot />{{ icon ? icon : "" }}</button>',
    props: ["disable", "loading", "outline", "round", "flat", "icon", "color", "size", "dense"],
    emits: ["click"],
    setup(_: unknown, { emit }: { emit: (event: string, ...args: unknown[]) => void }) {
      return {
        handleClick(e: Event) {
          if (e && e.stopPropagation) {
            e.stopPropagation();
          }
          emit("click", e);
        },
      };
    },
  },
  QPage: { template: "<div><slot /></div>" },
  QList: { template: "<div><slot /></div>" },
  QItem: {
    template:
      '<div class="q-item" :class="{ active: active }" @click="$emit(\'click\')"><slot /></div>',
    props: ["active", "clickable", "activeClass"],
  },
  QItemSection: { template: "<div><slot /></div>" },
  QItemLabel: { template: "<div><slot /></div>", props: ["caption"] },
  QInput: {
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :disabled="disable" />',
    props: ["modelValue", "disable", "outlined", "dense", "placeholder"],
  },
  QSlider: {
    template:
      '<input type="range" :value="modelValue" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" :min="min" :max="max" :step="step" />',
    props: ["modelValue", "min", "max", "step", "color"],
  },
  QTooltip: { template: "<span><slot /></span>", props: ["delay"] },
};

async function mountDialog(dialogOpened: boolean = true) {
  const wrapper = mount(ExtendedDictionaryDialog, {
    global: {
      plugins: [[Quasar, {}]],
      stubs: stubComponents,
    },
    props: {
      dialogOpened,
    },
  });
  // dialogOpened が true の場合、watch をトリガーするために props を更新
  if (dialogOpened) {
    // まず false に設定してから true に戻すことで watch がトリガーされる
    await wrapper.setProps({ dialogOpened: false });
    await nextTick();
    await wrapper.setProps({ dialogOpened: true });
    await nextTick();
    await flushPromises();
  }
  return wrapper;
}

describe("ExtendedDictionaryDialog.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getAll.mockResolvedValue(mockDictResponse);
    mockedApi.create.mockResolvedValue({ message: "ok" });
    mockedApi.delete.mockResolvedValue({ message: "deleted" });
    mockedApi.synthesizeDebug.mockResolvedValue(mockSynthesizeDebugResponse);
    mockedApi.synthesizePreview.mockResolvedValue(new ArrayBuffer(8));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("初期表示", () => {
    it("ダイアログが開いた時に辞書一覧を読み込む", async () => {
      const wrapper = await mountDialog(true);

      expect(mockedApi.getAll).toHaveBeenCalled();
      expect(wrapper.text()).toContain("テスト");
    });

    it("ダイアログが閉じている時はAPIを呼ばない", async () => {
      await mountDialog(false);

      expect(mockedApi.getAll).not.toHaveBeenCalled();
    });

    it("単語一覧が空の時は追加ボタンのみ表示", async () => {
      mockedApi.getAll.mockResolvedValue({ entries: [], total: 0 });
      const wrapper = await mountDialog(true);

      const items = wrapper.findAll(".q-item");
      expect(items.length).toBe(0);
      expect(wrapper.text()).toContain("追加");
    });
  });

  describe("単語選択", () => {
    it("単語をクリックするとフォームに値が入力される", async () => {
      const wrapper = await mountDialog(true);

      const items = wrapper.findAll(".q-item");
      expect(items.length).toBeGreaterThan(0);

      const item = items[0];
      await item.trigger("click");
      await flushPromises();

      const inputs = wrapper.findAll("input");
      expect(inputs.length).toBeGreaterThan(0);

      // 編集フォームが表示される
      expect(wrapper.text()).toContain("単語");
      expect(wrapper.text()).toContain("発音");
    });

    it("選択した単語がアクティブになる", async () => {
      const wrapper = await mountDialog(true);

      const items = wrapper.findAll(".q-item");
      expect(items.length).toBeGreaterThan(0);

      const item = items[0];
      await item.trigger("click");
      await flushPromises();

      expect(item.classes()).toContain("active");
    });
  });

  describe("発音取得", () => {
    it("発音取得ボタンでsynthesizeDebug APIを呼ぶ", async () => {
      const wrapper = await mountDialog(true);

      // 新規追加ボタンをクリック
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("追加"));
      expect(addButton).toBeDefined();
      await addButton!.trigger("click");
      await flushPromises();

      // 単語入力
      const wordInput = wrapper.find("input");
      await wordInput.setValue("ずんだもん");
      await flushPromises();

      // 発音取得ボタンをクリック
      const fetchButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("発音取得"));
      expect(fetchButton).toBeDefined();
      await fetchButton!.trigger("click");
      await flushPromises();

      expect(mockedApi.synthesizeDebug).toHaveBeenCalledWith("ずんだもん", 1);
    });

    it("発音取得成功後にモーラ別スライダーが表示される", async () => {
      const wrapper = await mountDialog(true);

      // 新規追加
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("追加"));
      await addButton!.trigger("click");
      await flushPromises();

      // 単語入力
      const wordInput = wrapper.find("input");
      await wordInput.setValue("テスト");
      await flushPromises();

      // 発音取得
      const fetchButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("発音取得"));
      await fetchButton!.trigger("click");
      await flushPromises();

      // モーラ別調整セクションが表示される
      expect(wrapper.text()).toContain("モーラ別調整");
      expect(wrapper.text()).toContain("ピッチ");
    });
  });

  describe("スライダー操作", () => {
    it("既存エントリ選択後にスライダーが表示される", async () => {
      const wrapper = await mountDialog(true);

      // 既存エントリを選択
      const items = wrapper.findAll(".q-item");
      expect(items.length).toBeGreaterThan(0);

      const item = items[0];
      await item.trigger("click");
      await flushPromises();

      // スライダー（range input）が存在するか確認
      const sliders = wrapper.findAll('input[type="range"]');
      expect(sliders.length).toBeGreaterThan(0);
    });
  });

  describe("保存", () => {
    it("保存ボタンクリックでcreate APIを呼ぶ", async () => {
      const wrapper = await mountDialog(true);

      // 新規追加
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("追加"));
      await addButton!.trigger("click");
      await flushPromises();

      // 単語入力
      const wordInput = wrapper.find("input");
      await wordInput.setValue("新しい単語");
      await flushPromises();

      // 発音取得（ピッチ値が必要なため）
      const fetchButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("発音取得"));
      await fetchButton!.trigger("click");
      await flushPromises();

      // 保存ボタンをクリック
      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("保存"));
      expect(saveButton).toBeDefined();
      await saveButton!.trigger("click");
      await flushPromises();

      expect(mockedApi.create).toHaveBeenCalled();
      const createArg = mockedApi.create.mock.calls[0][0];
      expect(createArg.word).toBe("新しい単語");
    });

    it("保存後に辞書一覧を再読み込み", async () => {
      const initialCallCount = mockedApi.getAll.mock.calls.length;
      const wrapper = await mountDialog(true);

      // 新規追加 -> 発音取得 -> 保存
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("追加"));
      await addButton!.trigger("click");
      await flushPromises();

      const wordInput = wrapper.find("input");
      await wordInput.setValue("新単語");
      await flushPromises();

      const fetchButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("発音取得"));
      await fetchButton!.trigger("click");
      await flushPromises();

      // getAll は最初の読み込みで呼ばれている
      const countBeforeSave = mockedApi.getAll.mock.calls.length;
      expect(countBeforeSave).toBeGreaterThan(initialCallCount);

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("保存"));
      await saveButton!.trigger("click");
      await flushPromises();

      // 保存後に再度getAll
      expect(mockedApi.getAll.mock.calls.length).toBeGreaterThan(countBeforeSave);
    });
  });

  describe("削除", () => {
    it("削除確認後にdelete APIを呼ぶ", async () => {
      // confirm をモック（true を返す）
      vi.mocked(globalThis.confirm).mockReturnValue(true);

      const wrapper = await mountDialog(true);

      // 削除ボタンは各単語の横にある（icon="delete_outline"）
      const deleteButton = wrapper
        .findAll("button")
        .find((b) => b.attributes("data-icon") === "delete_outline");

      expect(deleteButton).toBeDefined();
      await deleteButton!.trigger("click");
      await flushPromises();

      expect(mockedApi.delete).toHaveBeenCalledWith("テスト");
    });

    it("削除キャンセル時はAPIを呼ばない", async () => {
      // confirm をモック（false を返す）
      vi.mocked(globalThis.confirm).mockReturnValue(false);

      const wrapper = await mountDialog(true);

      const deleteButton = wrapper
        .findAll("button")
        .find((b) => b.attributes("data-icon") === "delete_outline");

      expect(deleteButton).toBeDefined();
      await deleteButton!.trigger("click");
      await flushPromises();

      expect(mockedApi.delete).not.toHaveBeenCalled();
    });
  });

  describe("エラーハンドリング", () => {
    it("保存失敗時にエラーメッセージを表示", async () => {
      // 最初の読み込みは成功、保存は失敗
      mockedApi.getAll.mockResolvedValue(mockDictResponse);
      mockedApi.create.mockRejectedValue(new Error("Save failed"));

      const wrapper = await mountDialog(true);

      // 新規追加 -> 発音取得 -> 保存
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("追加"));
      await addButton!.trigger("click");
      await flushPromises();

      const wordInput = wrapper.find("input");
      await wordInput.setValue("新単語");
      await flushPromises();

      const fetchButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("発音取得"));
      await fetchButton!.trigger("click");
      await flushPromises();

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("保存"));
      await saveButton!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("Save failed");
    });

    it("発音取得失敗時にエラーメッセージを表示", async () => {
      mockedApi.synthesizeDebug.mockRejectedValue(new Error("Fetch failed"));

      const wrapper = await mountDialog(true);

      // 新規追加
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("追加"));
      await addButton!.trigger("click");
      await flushPromises();

      const wordInput = wrapper.find("input");
      await wordInput.setValue("テスト単語");
      await flushPromises();

      const fetchButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("発音取得"));
      await fetchButton!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("Fetch failed");
    });
  });

  describe("キャンセル", () => {
    it("キャンセルボタンで編集フォームを閉じる", async () => {
      const wrapper = await mountDialog(true);

      // 新規追加
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("追加"));
      await addButton!.trigger("click");
      await flushPromises();

      // 編集フォームが表示されている
      expect(wrapper.text()).toContain("単語");

      // キャンセル
      const cancelButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("キャンセル"));
      expect(cancelButton).toBeDefined();
      await cancelButton!.trigger("click");
      await flushPromises();

      // 「単語を選択するか」のプロンプトが表示される
      expect(wrapper.text()).toContain(
        "単語を選択するか、「追加」ボタンを押してください"
      );
    });
  });
});

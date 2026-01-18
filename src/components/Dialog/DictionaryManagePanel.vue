<template>
  <div class="dictionary-manage-panel row">
    <div v-if="loadingDictState" class="loading-dict">
      <div>
        <QSpinner color="primary" size="2.5rem" />
        <div class="q-mt-xs">
          <template v-if="loadingDictState === 'loading'"
            >読み込み中・・・</template
          >
          <template v-if="loadingDictState === 'synchronizing'"
            >同期中・・・</template
          >
        </div>
      </div>
    </div>
    <div class="col-4 word-list-col">
      <div
        v-if="wordEditing"
        class="word-list-disable-overlay"
        @click="discardOrNotDialog(cancel)"
      />
      <div class="word-list-header text-no-wrap">
        <div class="row word-list-title">
          <span class="text-h5 col-8">単語一覧</span>
          <QBtn
            outline
            textColor="display"
            class="text-no-wrap text-bold col"
            :disable="uiLocked"
            @click="newWord"
            >追加</QBtn
          >
        </div>
      </div>
      <QList class="word-list">
        <QItem
          v-for="(value, key) in userDict"
          :key
          v-ripple
          tag="label"
          clickable
          :active="selectedId === key"
          activeClass="active-word"
          @click="selectWord(key)"
          @dblclick="editWord"
          @mouseover="hoveredKey = key"
          @mouseleave="hoveredKey = undefined"
        >
          <QItemSection>
            <QItemLabel lines="1" class="text-display">{{
              value.surface
            }}</QItemLabel>
            <QItemLabel lines="1" caption>{{ value.yomi }}</QItemLabel>
          </QItemSection>

          <QItemSection
            v-if="!uiLocked && (hoveredKey === key || selectedId === key)"
            side
          >
            <div class="q-gutter-xs">
              <QBtn
                size="12px"
                flat
                dense
                round
                icon="edit"
                @click.stop="
                  selectWord(key);
                  editWord();
                "
              >
                <QTooltip :delay="500">編集</QTooltip>
              </QBtn>
              <QBtn
                size="12px"
                flat
                dense
                round
                icon="delete_outline"
                @click.stop="
                  selectWord(key);
                  deleteWord();
                "
              >
                <QTooltip :delay="500">削除</QTooltip>
              </QBtn>
            </div>
          </QItemSection>
        </QItem>
      </QList>
    </div>

    <DictionaryEditWordDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, provide } from "vue";
import { QInput } from "quasar";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import { dictionaryManageDialogContextKey } from "./dictionaryContext";
import { useStore } from "@/store";
import { AccentPhrase, UserDictWord } from "@/openapi";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/domain/japanese";

const defaultDictPriority = 5;

const store = useStore();

const uiLocked = ref(false);
const hoveredKey = ref<string | undefined>(undefined);
const loadingDictState = ref<null | "loading" | "synchronizing">("loading");
const userDict = ref<Record<string, UserDictWord>>({});

const createUILockAction = function <T>(action: Promise<T>) {
  uiLocked.value = true;
  return action.finally(() => {
    uiLocked.value = false;
  });
};

const loadingDictProcess = async () => {
  if (store.state.engineIds.length === 0)
    throw new Error(`assert engineId.length > 0`);

  loadingDictState.value = "loading";
  try {
    userDict.value = await createUILockAction(
      store.actions.LOAD_ALL_USER_DICT(),
    );
  } catch {
    await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の取得に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
  }
  loadingDictState.value = "synchronizing";
  try {
    await createUILockAction(store.actions.SYNC_ALL_USER_DICT());
  } catch {
    await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の同期に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
  }
  loadingDictState.value = null;
};

onMounted(async () => {
  await loadingDictProcess();
  toInitialState();
});

const wordEditing = ref(false);
const surfaceInput = ref<QInput>();
const selectedId = ref("");
const surface = ref("");
const yomi = ref("");

const voiceComputed = computed(() => {
  const userOrderedCharacterInfos =
    store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (userOrderedCharacterInfos == undefined)
    throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
  if (store.state.engineIds.length === 0)
    throw new Error("assert engineId.length > 0");
  const characterInfo = userOrderedCharacterInfos[0].metas;
  const speakerId = characterInfo.speakerUuid;
  const { engineId, styleId } = characterInfo.styles[0];
  return { engineId, speakerId, styleId };
});

const kanaRegex = createKanaRegex();
const isOnlyHiraOrKana = ref(true);
const accentPhrase = ref<AccentPhrase | undefined>();

const setYomi = async (text: string, changeWord?: boolean) => {
  const { engineId, styleId } = voiceComputed.value;

  isOnlyHiraOrKana.value = !text.length || kanaRegex.test(text);
  if (
    text ==
      accentPhrase.value?.moras
        .map((v) => v.text)
        .join("")
        .slice(0, -1) &&
    !changeWord
  ) {
    return;
  }
  if (isOnlyHiraOrKana.value && text.length) {
    text = convertHiraToKana(text);
    text = convertLongVowel(text);
    accentPhrase.value = (
      await createUILockAction(
        store.actions.FETCH_ACCENT_PHRASES({
          text: text + "ガ'",
          engineId,
          styleId,
          isKana: true,
        }),
      )
    )[0];
    if (selectedId.value && userDict.value[selectedId.value].yomi === text) {
      accentPhrase.value.accent = computeDisplayAccent();
    }
  } else {
    accentPhrase.value = undefined;
  }
  yomi.value = text;
};

const computeRegisteredAccent = () => {
  if (!accentPhrase.value) throw new Error();
  let accent = accentPhrase.value.accent;
  accent = accent === accentPhrase.value.moras.length ? 0 : accent;
  return accent;
};

const computeDisplayAccent = () => {
  if (!accentPhrase.value || !selectedId.value) throw new Error();
  let accent = userDict.value[selectedId.value].accentType;
  accent = accent === 0 ? accentPhrase.value.moras.length : accent;
  return accent;
};

const wordPriority = ref(defaultDictPriority);

const isWordChanged = computed(() => {
  if (selectedId.value === "") {
    return (
      surface.value != "" && yomi.value != "" && accentPhrase.value != undefined
    );
  }
  const dict = userDict.value;
  const dictData = dict[selectedId.value];
  return (
    dictData &&
    (dictData.surface !== surface.value ||
      dictData.yomi !== yomi.value ||
      dictData.accentType !== computeRegisteredAccent() ||
      dictData.priority !== wordPriority.value)
  );
});

const deleteWord = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語を削除しますか？",
    message: "削除された単語は元に戻せません。",
    actionName: "削除する",
    isWarningColorButton: true,
    cancel: "削除しない",
  });
  if (result === "OK") {
    try {
      await createUILockAction(
        store.actions.DELETE_WORD({
          wordUuid: selectedId.value,
        }),
      );
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の削除に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
    await loadingDictProcess();
    toInitialState();
  }
};

const discardOrNotDialog = async (okCallback: () => void) => {
  if (isWordChanged.value) {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "単語の追加・変更を破棄しますか？",
      message: "変更を破棄すると、単語の追加・変更はリセットされます。",
      actionName: "破棄する",
      cancel: "破棄しない",
      isWarningColorButton: true,
    });
    if (result === "OK") {
      okCallback();
    }
  } else {
    okCallback();
  }
};

const newWord = () => {
  selectedId.value = "";
  surface.value = "";
  void setYomi("");
  wordPriority.value = defaultDictPriority;
  editWord();
};

const editWord = () => {
  toWordEditingState();
};

const selectWord = (id: string) => {
  selectedId.value = id;
  surface.value = userDict.value[id].surface;
  void setYomi(userDict.value[id].yomi, true);
  wordPriority.value = userDict.value[id].priority;
  toWordSelectedState();
};

const cancel = () => {
  toInitialState();
};

const toInitialState = () => {
  wordEditing.value = false;
  selectedId.value = "";
  surface.value = "";
  void setYomi("");
  wordPriority.value = defaultDictPriority;
};

const toWordSelectedState = () => {
  wordEditing.value = false;
};

const toWordEditingState = () => {
  wordEditing.value = true;
  surfaceInput.value?.focus();
};

provide(dictionaryManageDialogContextKey, {
  wordEditing,
  surfaceInput,
  selectedId,
  uiLocked,
  userDict,
  isOnlyHiraOrKana,
  accentPhrase,
  voiceComputed,
  surface,
  yomi,
  wordPriority,
  isWordChanged,
  setYomi,
  createUILockAction,
  loadingDictProcess,
  computeRegisteredAccent,
  discardOrNotDialog,
  toInitialState,
  toWordEditingState,
  cancel,
});
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.dictionary-manage-panel {
  height: 100%;
  width: 100%;
  position: relative;
}

.word-list-col {
  border-right: solid 1px colors.$surface;
  position: relative;
  overflow-x: hidden;
}

.word-list-header {
  margin: 1rem;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  .word-list-title {
    flex-grow: 1;
  }
}

.word-list {
  height: calc(100vh - 200px);
  width: 100%;
  overflow-y: auto;
  padding-bottom: 16px;
}

.active-word {
  background: rgba(colors.$primary-rgb, 0.4);
}

.loading-dict {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$background;
    border-radius: 6px;
    padding: 14px;
  }
}

.word-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}
</style>

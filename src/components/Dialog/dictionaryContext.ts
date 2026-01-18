import { Ref, ComputedRef, type InjectionKey } from "vue";
import { QInput } from "quasar";
import { AccentPhrase, UserDictWord } from "@/openapi";
import { EngineId, SpeakerId, StyleId } from "@/type/preload";

export const dictionaryManageDialogContextKey: InjectionKey<{
  wordEditing: Ref<boolean>;
  surfaceInput: Ref<QInput | undefined>;
  selectedId: Ref<string>;
  uiLocked: Ref<boolean>;
  userDict: Ref<Record<string, UserDictWord>>;
  isOnlyHiraOrKana: Ref<boolean>;
  accentPhrase: Ref<AccentPhrase | undefined>;
  voiceComputed: ComputedRef<{
    engineId: EngineId;
    speakerId: SpeakerId;
    styleId: StyleId;
  }>;
  surface: Ref<string>;
  yomi: Ref<string>;
  wordPriority: Ref<number>;
  isWordChanged: ComputedRef<boolean>;
  setYomi: (text: string, changeWord?: boolean) => Promise<void>;
  createUILockAction: <T>(action: Promise<T>) => Promise<T>;
  loadingDictProcess: () => Promise<void>;
  computeRegisteredAccent: () => number;
  discardOrNotDialog: (okCallback: () => void) => Promise<void>;
  toInitialState: () => void;
  toWordEditingState: () => void;
  cancel: () => void;
}> = Symbol("dictionaryManageDialogContextKey");

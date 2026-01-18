<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer>
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display"> 辞書管理 </QToolbarTitle>
            <QSpace />
            <QBtn
              round
              flat
              icon="close"
              color="display"
              @click="closeDialog"
            />
          </QToolbar>
        </QHeader>

        <QPage class="column">
          <!-- タブ切り替え -->
          <QTabs
            v-model="activeTab"
            class="text-display bg-surface"
            activeColor="primary"
            indicatorColor="primary"
            align="left"
            dense
          >
            <QTab name="accent" label="読み方＆アクセント" />
            <QTab name="intonation" label="イントネーション" />
          </QTabs>

          <QSeparator />

          <!-- タブパネル -->
          <QTabPanels v-model="activeTab" animated class="col bg-background">
            <!-- 読み方＆アクセント辞書 -->
            <QTabPanel name="accent" class="q-pa-none full-height-panel">
              <DictionaryManagePanel v-if="activeTab === 'accent'" />
            </QTabPanel>

            <!-- イントネーション辞書 -->
            <QTabPanel name="intonation" class="q-pa-none full-height-panel">
              <ExtendedDictionaryPanel v-if="activeTab === 'intonation'" />
            </QTabPanel>
          </QTabPanels>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import DictionaryManagePanel from "./DictionaryManagePanel.vue";
import ExtendedDictionaryPanel from "./ExtendedDictionaryPanel.vue";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });
const activeTab = ref("accent");

function closeDialog() {
  dialogOpened.value = false;
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;

.q-tab-panels {
  overflow: hidden;
}

.full-height-panel {
  height: 100%;
  overflow: hidden;
}
</style>

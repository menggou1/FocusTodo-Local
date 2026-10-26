/* Local application bootstrap. Preserve installation order before the legacy bundle. */
(function(root) {
    'use strict';
    const identity = root.FocusLocalData.installIdentity();
    root.FocusLocalNetwork.install(identity);
    root.FocusLocalBackup.installUI();
    root.FocusSettings.installCompatibility(identity);
    root.FocusThemeStorage.installUI(identity);
})(window);

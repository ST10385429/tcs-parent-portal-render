import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

type LanguageCode =
  | "en"
  | "af"
  | "zu"
  | "xh"
  | "nso"
  | "st"
  | "tn"
  | "ss"
  | "ve"
  | "ts"
  | "nr"
  | "sfs";

type LanguageOption = {
  code: LanguageCode;
  name: string;
  nativeName: string;
};

const LANGUAGE_STORAGE_KEY = "@tcs/language";

const languages: LanguageOption[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
  },
  {
    code: "af",
    name: "Afrikaans",
    nativeName: "Afrikaans",
  },
  {
    code: "zu",
    name: "isiZulu",
    nativeName: "isiZulu",
  },
  {
    code: "xh",
    name: "isiXhosa",
    nativeName: "isiXhosa",
  },
  {
    code: "nso",
    name: "Sepedi",
    nativeName: "Sesotho sa Leboa",
  },
  {
    code: "st",
    name: "Sesotho",
    nativeName: "Sesotho",
  },
  {
    code: "tn",
    name: "Setswana",
    nativeName: "Setswana",
  },
  {
    code: "ss",
    name: "siSwati",
    nativeName: "siSwati",
  },
  {
    code: "ve",
    name: "Tshivenda",
    nativeName: "Tshivenda",
  },
  {
    code: "ts",
    name: "Xitsonga",
    nativeName: "Xitsonga",
  },
  {
    code: "nr",
    name: "isiNdebele",
    nativeName: "isiNdebele",
  },
  {
    code: "sfs",
    name: "South African Sign Language",
    nativeName: "SASL",
  },
];

const validLanguageCodes: LanguageCode[] = languages.map(
  (language) => language.code,
);

export default function LanguageScreen() {
  const router = useRouter();

  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");

  const [savedLanguage, setSavedLanguage] = useState<LanguageCode>("en");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((storedLanguage) => {
        if (
          storedLanguage &&
          validLanguageCodes.includes(storedLanguage as LanguageCode)
        ) {
          const savedCode = storedLanguage as LanguageCode;

          setSelectedLanguage(savedCode);
          setSavedLanguage(savedCode);
        }
      })
      .catch(() => {
        setMessage(
          "The saved language could not be loaded. English is being used.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleLanguageSelection = (languageCode: LanguageCode) => {
    setSelectedLanguage(languageCode);
    setMessage("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);

      setSavedLanguage(selectedLanguage);
      setMessage("Language preference saved successfully.");
    } catch {
      setMessage(
        "The language preference could not be saved. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanged = selectedLanguage !== savedLanguage;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={colors.textOnPrimary} size="large" />

        <Text style={styles.loadingText}>Loading language preference...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to profile"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="chevron-back"
              size={24}
            />

            <Text style={styles.backText}>Profile</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Language</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introductionCard}>
            <View style={styles.introductionIcon}>
              <Ionicons
                color={colors.primary}
                name="language-outline"
                size={27}
              />
            </View>

            <Text style={styles.introductionTitle}>
              Choose your preferred language
            </Text>

            <Text style={styles.introductionText}>
              School content will use your preferred language whenever an
              approved translation is available.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>
            SOUTH AFRICAN OFFICIAL LANGUAGES
          </Text>

          <View style={styles.languageCard}>
            {languages.map((language, index) => {
              const isSelected = selectedLanguage === language.code;

              const isSaved = savedLanguage === language.code;

              return (
                <View key={language.code}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={language.name}
                    accessibilityState={{
                      checked: isSelected,
                    }}
                    onPress={() => handleLanguageSelection(language.code)}
                    style={({ pressed }) => [
                      styles.languageRow,
                      isSelected && styles.languageRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>

                    <View style={styles.languageInformation}>
                      <Text style={styles.languageName}>{language.name}</Text>

                      {language.nativeName !== language.name ? (
                        <Text style={styles.nativeName}>
                          {language.nativeName}
                        </Text>
                      ) : null}
                    </View>

                    {isSaved ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentText}>CURRENT</Text>
                      </View>
                    ) : null}
                  </Pressable>

                  {index < languages.length - 1 ? (
                    <View style={styles.divider} />
                  ) : null}
                </View>
              );
            })}
          </View>

          {message ? (
            <View accessibilityRole="alert" style={styles.messageCard}>
              <Ionicons
                color={colors.success}
                name="information-circle-outline"
                size={21}
              />

              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save language"
            accessibilityState={{
              disabled: !hasChanged || isSaving,
              busy: isSaving,
            }}
            disabled={!hasChanged || isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              (!hasChanged || isSaving) && styles.saveButtonDisabled,
              pressed && hasChanged && !isSaving && styles.saveButtonPressed,
            ]}
          >
            {isSaving ? (
              <>
                <ActivityIndicator color={colors.textOnPrimary} size="small" />

                <Text style={styles.saveText}>Saving...</Text>
              </>
            ) : (
              <>
                <Ionicons
                  color={colors.textOnPrimary}
                  name="save-outline"
                  size={20}
                />

                <Text style={styles.saveText}>Save Language</Text>
              </>
            )}
          </Pressable>

          <View style={styles.translationNotice}>
            <Ionicons
              color={colors.info}
              name="information-circle-outline"
              size={19}
            />

            <Text style={styles.translationNoticeText}>
              Saving a language preference is fully functional. Complete
              interface translations will be introduced once the school supplies
              approved translations.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  loadingText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    marginTop: 13,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
  },

  backButton: {
    width: 80,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: "800",
  },

  headerSpacer: {
    width: 80,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
  },

  introductionCard: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    padding: 22,
  },

  introductionIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 28,
  },

  introductionTitle: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
  },

  introductionText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },

  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginTop: 24,
    marginBottom: 9,
    marginLeft: 3,
  },

  languageCard: {
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },

  languageRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  languageRowSelected: {
    backgroundColor: "#F4F8F6",
  },

  radioOuter: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 11,
  },

  radioOuterSelected: {
    borderColor: colors.primary,
  },

  radioInner: {
    width: 11,
    height: 11,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },

  languageInformation: {
    flex: 1,
    marginLeft: 13,
  },

  languageName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  nativeName: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },

  currentBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  currentText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 51,
  },

  messageCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F4EC",
    borderRadius: 14,
    marginTop: 14,
    padding: 13,
  },

  messageText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
  },

  saveButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.primary,
    borderRadius: 15,
    marginTop: 21,
    paddingHorizontal: 18,
  },

  saveButtonDisabled: {
    opacity: 0.45,
  },

  saveButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.99 }],
  },

  saveText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  translationNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E8F3F8",
    borderRadius: 14,
    marginTop: 15,
    padding: 13,
  },

  translationNoticeText: {
    flex: 1,
    color: colors.info,
    fontSize: 10,
    lineHeight: 16,
    marginLeft: 8,
  },

  pressed: {
    opacity: 0.65,
  },
});

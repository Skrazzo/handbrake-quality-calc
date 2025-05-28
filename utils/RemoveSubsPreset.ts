import { PRESET_FILE } from "../consts";
import { logs } from "./LogsClass";

const changeValue = (preset: any, key: any, newValue: any) => {
    // Check if value exists
    if (!preset.PresetList[0][key]) {
        logs.warn(`${key} does not exist, and won't be changed in the preset`);
        return preset;
    }

    // Change and return
    preset.PresetList[0][key] = newValue;
    return preset;
};

export const generatePresetWithNoSubtitles = async (outputPath: string) => {
    let preset = await Bun.file(PRESET_FILE).json();

    if (preset.PresetList.length === 0) throw new Error("Invalid preset file");

    preset = changeValue(preset, "SubtitleAddForeignAudioSearch", false);
    preset = changeValue(preset, "SubtitleBurnBDSub", false);
    preset = changeValue(preset, "SubtitleBurnBehavior", "");
    preset = changeValue(preset, "SubtitleBurnDVDSub", false);
    preset = changeValue(preset, "SubtitleLanguageList", []);
    preset = changeValue(preset, "SubtitleTrackSelectionBehavior", "none");

    await Bun.file(outputPath).write(JSON.stringify(preset, null, 4));
    logs.info("Wrote modified preset with no subs");
};

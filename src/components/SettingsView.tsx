import {
  ArrowUpRight,
  ChevronRight,
  Eye,
  Moon,
  Paintbrush,
  ShieldCheck,
  Smartphone,
  Type,
  Twitter,
  Youtube,
} from "lucide-react";
import { version } from "../../package.json";
import { reader, useReader } from "../store";
import type { Preferences } from "../store";
export function SettingsView() {
  const prefs = useReader().preferences;
  return (
    <div className="settings-page">
      <div className="group-label">APPEARANCE</div>
      <div className="settings-group">
        <label className="settings-row settings-picker">
          <span className="settings-icon purple">
            <Moon size={18} />
          </span>
          <span>Theme</span>
          <select
            aria-label="Theme"
            value={prefs.theme}
            onChange={(event) => reader.setPreferences({
              theme: event.target.value as Preferences["theme"],
            })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <ChevronRight size={15} />
        </label>
        <label className="settings-row settings-picker">
          <span className="settings-icon blue">
            <Paintbrush size={18} />
          </span>
          <span>Post layout</span>
          <select
            aria-label="Post layout"
            value={prefs.layout}
            onChange={(event) => reader.setPreferences({
              layout: event.target.value as Preferences["layout"],
            })}
          >
            <option value="large">Large</option>
            <option value="compact">Compact</option>
          </select>
          <ChevronRight size={15} />
        </label>
        <label className="settings-row settings-picker">
          <span className="settings-icon orange">
            <Type size={19} />
          </span>
          <span>Text size</span>
          <select
            aria-label="Text size"
            value={prefs.textSize}
            onChange={(event) => reader.setPreferences({
              textSize: event.target.value as Preferences["textSize"],
            })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
          <ChevronRight size={15} />
        </label>
        <label className="settings-row">
          <span className="settings-icon green">
            <Eye size={19} />
          </span>
          <span>Dim read posts</span>
          <input
            className="switch-input"
            type="checkbox"
            checked={prefs.dimRead}
            onChange={(event) => reader.setPreferences({
              dimRead: event.target.checked,
            })}
          />
          <span className="switch" aria-hidden="true" />
        </label>
      </div>
      <div className="group-label">PREVIEWS</div>
      <div className="settings-group">
        <label className="settings-row settings-picker">
          <span className="settings-icon blue">
            <Twitter size={18} />
          </span>
          <span>Display Twitter/X as</span>
          <select
            aria-label="Display Twitter/X as"
            value={prefs.twitterDisplay}
            onChange={(event) => reader.setPreferences({
              twitterDisplay: event.target.value as Preferences["twitterDisplay"],
            })}
          >
            <option value="embedded">Embedded</option>
            <option value="previews">Link preview</option>
          </select>
          <ChevronRight size={15} />
        </label>
        <label className="settings-row settings-picker">
          <span className="settings-icon red">
            <Youtube size={18} />
          </span>
          <span>Display YouTube as</span>
          <select
            aria-label="Display YouTube as"
            value={prefs.youtubeDisplay}
            onChange={(event) => reader.setPreferences({
              youtubeDisplay: event.target.value as Preferences["youtubeDisplay"],
            })}
          >
            <option value="embedded">Embedded</option>
            <option value="previews">Link preview</option>
          </select>
          <ChevronRight size={15} />
        </label>
      </div>
      <div className="group-label">ABOUT</div>
      <div className="settings-group">
        <div className="settings-row">
          <img
            className="settings-icon"
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt="Hnollo app icon"
            width="28"
            height="28"
          />
          <span>Hnollo</span>
          <span className="settings-value">{version}</span>
        </div>
        <a className="settings-row" href="#/settings/privacy">
          <span className="settings-icon green">
            <ShieldCheck size={18} />
          </span>
          <span>Privacy</span>
          <ChevronRight size={15} />
        </a>
        <a
          className="settings-row"
          href="https://news.ycombinator.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="settings-icon orange hn-icon">Y</span>
          <span>Visit Hacker News</span>
          <ArrowUpRight size={17} />
        </a>
        <a
          className="settings-row"
          href="https://apolloapp.io"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="settings-icon blue">
            <Smartphone size={18} />
          </span>
          <span>Inspired by Apollo</span>
          <ArrowUpRight size={17} />
        </a>
      </div>
      <p className="group-note">
        Hnollo is an unofficial HN client in the style of Apollo. Not affiliated with Hacker News or Apollo.
      </p>
    </div>
  );
}

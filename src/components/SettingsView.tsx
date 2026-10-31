import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Eye,
  History,
  Moon,
  Paintbrush,
  ShieldCheck,
  Smartphone,
  Type,
} from "lucide-react";
import { reader, useReader } from "../store";
import type { Preferences } from "../store";
export function SettingsView({ onClear }: { onClear: () => void }) {
  const state = useReader();
  const prefs = state.preferences;
  return (
    <div className="settings-page">
      <div className="about-app">
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt="Hnollo app icon"
          width="76"
          height="76"
        />
        <h1>Hnollo</h1>
        <p>A familiar place for curious minds.</p>
        <span>Hacker News, in the spirit of Apollo.</span>
      </div>
      <div className="group-label">APPEARANCE</div>
      <div className="settings-group">
        <label className="settings-row">
          <span className="settings-icon purple">
            <Moon size={18} />
          </span>
          <span>Theme</span>
          <select
            aria-label="Theme"
            value={prefs.theme}
            onChange={(event) =>
              reader.setPreferences({
                theme: event.target.value as Preferences["theme"],
              })
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <ChevronRight size={15} />
        </label>
        <label className="settings-row">
          <span className="settings-icon blue">
            <Paintbrush size={18} />
          </span>
          <span>Post size</span>
          <select
            aria-label="Post size"
            value={prefs.layout}
            onChange={(event) =>
              reader.setPreferences({
                layout: event.target.value as Preferences["layout"],
              })
            }
          >
            <option value="large">Large</option>
            <option value="compact">Compact</option>
          </select>
          <ChevronRight size={15} />
        </label>
        <label className="settings-row">
          <span className="settings-icon orange">
            <Type size={19} />
          </span>
          <span>Text size</span>
          <select
            aria-label="Text size"
            value={prefs.textSize}
            onChange={(event) =>
              reader.setPreferences({
                textSize: event.target.value as Preferences["textSize"],
              })
            }
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
          <ChevronRight size={15} />
        </label>
      </div>
      <div className="group-label">READING</div>
      <div className="settings-group">
        <label className="settings-row">
          <span className="settings-icon green">
            <Eye size={19} />
          </span>
          <span>Dim read posts</span>
          <input
            className="switch-input"
            type="checkbox"
            checked={prefs.dimRead}
            onChange={(event) =>
              reader.setPreferences({ dimRead: event.target.checked })
            }
          />
          <span className="switch" aria-hidden="true" />
        </label>
        <div className="settings-row">
          <span className="settings-icon blue">
            <BookOpen size={18} />
          </span>
          <span>Reading history</span>
          <span className="settings-value">
            {Object.keys(state.posts).length} posts ·{" "}
            {Object.keys(state.comments).length} comments
          </span>
        </div>
        <button className="settings-row clear-history" onClick={onClear}>
          <span className="settings-icon red">
            <History size={18} />
          </span>
          <span>Clear reading history</span>
          <ChevronRight size={15} />
        </button>
      </div>
      <p className="group-note">
        Posts and their comments are marked as read when you open a post. New
        replies stay highlighted for the current visit. Your history and saved
        posts stay on this device.
      </p>
      <div className="group-label">A LITTLE MORE</div>
      <div className="settings-group">
        <div className="settings-row">
          <span className="settings-icon green">
            <ShieldCheck size={18} />
          </span>
          <span>No account. No tracking.</span>
        </div>
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
          <span>With love for Apollo</span>
          <ArrowUpRight size={17} />
        </a>
      </div>
      <p className="group-note">
        An independent, read-only reader. Not affiliated with Apollo, Christian
        Selig, or Y Combinator.
      </p>
      <div className="version-note">
        HNOLLO 1.0
        <br />
        <span>Made for the joy of reading.</span>
      </div>
    </div>
  );
}

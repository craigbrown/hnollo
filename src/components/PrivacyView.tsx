import { LockKeyhole } from "lucide-react";

export function PrivacyView({ onDone }: { onDone: () => void }) {
  return (
    <div className="privacy-page">
      <div className="privacy-explanation">
        <LockKeyhole
          className="privacy-symbol"
          size={44}
          strokeWidth={1.7}
          aria-hidden="true"
        />
        <h1>Hnollo &amp; Privacy</h1>
        <div className="privacy-copy">
          <p>Your saved posts, reading and search history, and preferences stay in this browser. They aren't synced to an account.</p>
          <p>Hnollo has no analytics or advertising trackers. Stories and search results come from the official Hacker News API and Algolia. Your device contacts these services as you browse posts or search.</p>
          <p>Article previews may contact publishers and image hosts. These services and Hnollo's host can receive your IP address and browser information.</p>
          <p>You can clear your post history at any time using the Clear button on the History tab.</p>
          <p>You can remove individual saved posts using the "Unsave" option. Individual searches can also be removed from the Search page.</p>
          <p>To remove all local data, including saved posts, preferences, and cached previews, clear this site's data in your browser settings.</p>
        </div>
      </div>
      <div className="privacy-actions">
        <button className="privacy-done" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

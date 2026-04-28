import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

/**
 * Legal pages — Terms of Service and Privacy Policy.
 *
 * These are reasonable boilerplate drafted for a free-to-play, skill-based
 * fan-engagement platform operating in India under the post-2025 online
 * gaming framework. They are NOT a substitute for a lawyer's review before
 * the platform scales or accepts paid entries — see the comment near the
 * top of each page for what to flag with counsel.
 */

const PAGE_STYLE: React.CSSProperties = {
  paddingTop: 80,
  paddingBottom: 80,
  minHeight: '100vh',
  fontFamily: "'Instrument Sans', system-ui, sans-serif",
};

const CONTAINER: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '0 24px',
  color: 'var(--text2)',
  fontSize: 15,
  lineHeight: 1.7,
};

const H1_STYLE: React.CSSProperties = {
  fontFamily: "'Cabinet Grotesk', sans-serif",
  fontSize: 38,
  fontWeight: 900,
  letterSpacing: '-1px',
  color: 'var(--text)',
  marginBottom: 8,
};

const META_STYLE: React.CSSProperties = {
  color: 'var(--muted)',
  fontSize: 13,
  marginBottom: 36,
};

const H2_STYLE: React.CSSProperties = {
  fontFamily: "'Cabinet Grotesk', sans-serif",
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--text)',
  marginTop: 36,
  marginBottom: 12,
};

const EFFECTIVE_DATE = 'April 2026';

export function TermsPage() {
  useSeo({
    title: 'Terms of Service | Crowdbash',
    description:
      'Crowdbash Terms of Service — free-to-play, skill-based fantasy sports platform. Eligibility, conduct, and platform rules.',
    path: '/terms',
  });
  return (
    <div style={PAGE_STYLE}>
      <div style={CONTAINER}>
        {/* TODO: lawyer review before scaling or accepting paid entries. */}
        <Breadcrumb />
        <h1 style={H1_STYLE}>Terms of Service</h1>
        <p style={META_STYLE}>Effective: {EFFECTIVE_DATE} · Free-to-play · Skill-based</p>

        <p>
          Welcome to Crowdbash. These Terms of Service (&quot;Terms&quot;) govern your
          use of Crowdbash — a free-to-play, skill-based sports fan-engagement
          platform operated by Coding Ryder (&quot;we&quot;, &quot;us&quot;). By creating an
          account or using the platform, you agree to these Terms.
        </p>

        <h2 style={H2_STYLE}>1. What Crowdbash is</h2>
        <p>
          Crowdbash is a fan-engagement game where you build a fantasy XI
          across cricket and football, allocate Power across your players, and
          your Bashpoints reflect your skill at predicting how those players
          perform during a match. Crowdbash is <strong>100% free to play</strong>:
          there are no entry fees, no deposits, no wallets, no winnings pools,
          and no real-money stakes of any kind.
        </p>

        <h2 style={H2_STYLE}>2. Eligibility</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>You must be <strong>18 years of age or older</strong> to use Crowdbash.</li>
          <li>You must not be a resident of any Indian state or jurisdiction where participation in skill-based fantasy gaming is restricted (which currently includes, but is not limited to, Telangana, Andhra Pradesh, and Assam).</li>
          <li>You agree to provide accurate signup details and not impersonate anyone else.</li>
        </ul>

        <h2 style={H2_STYLE}>3. Bashpoints and rewards</h2>
        <p>
          Bashpoints are an in-platform recognition score earned through
          skill-based gameplay (top finishes in fantasy rooms, daily check-in,
          signup bonus, etc.). Bashpoints have <strong>no monetary value</strong>,
          are not transferable between users, and cannot be exchanged for cash.
        </p>
        <p>
          Where redemption options exist, they are promotional fan perks,
          fulfilled at our discretion. Any single redemption is capped at a
          fixed value (currently ₹250). Rewards may be added or removed at any
          time, are not guaranteed, and may be voided in cases of suspected
          fraud, abuse, multi-accounting, or inactive accounts.
        </p>

        <h2 style={H2_STYLE}>4. Skill, not chance</h2>
        <p>
          Crowdbash gameplay rewards skill: team selection within role caps,
          power distribution across 11 players, mid-match reshuffle decisions,
          and reading match conditions. Outcomes are determined predominantly
          by these skill-based choices and the real-world performance of the
          players you select.
        </p>

        <h2 style={H2_STYLE}>5. Account &amp; security</h2>
        <p>
          You are responsible for your account credentials and for all activity
          under your account. You agree not to share your account, automate
          gameplay, exploit bugs, or interfere with other users&apos; experience.
          We may suspend or terminate accounts that violate these Terms.
        </p>

        <h2 style={H2_STYLE}>6. Acceptable use</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>No abusive, harassing, or unlawful content in chat or usernames.</li>
          <li>No automation, bots, or scripts.</li>
          <li>No reverse-engineering, scraping, or unauthorised commercial use.</li>
          <li>No multi-accounting to abuse rewards.</li>
        </ul>

        <h2 style={H2_STYLE}>7. Content &amp; intellectual property</h2>
        <p>
          Crowdbash branding, design, software, and content are owned by us.
          Player names, team names, and match data are sourced from public
          sports feeds and used for fan-engagement purposes; all third-party
          marks belong to their respective owners.
        </p>

        <h2 style={H2_STYLE}>8. Disclaimers &amp; limitation of liability</h2>
        <p>
          Crowdbash is provided &quot;as is&quot;. We make no warranty about
          uninterrupted availability, real-time score accuracy (which depends
          on third-party feeds), or the success of any redemption. To the
          maximum extent permitted by law, our aggregate liability for any
          claim arising out of your use of the platform is limited to ₹500.
        </p>

        <h2 style={H2_STYLE}>9. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be
          surfaced in the app on your next sign-in, and continued use after
          such notice constitutes acceptance.
        </p>

        <h2 style={H2_STYLE}>10. Governing law</h2>
        <p>
          These Terms are governed by the laws of India. Any dispute will be
          subject to the exclusive jurisdiction of the competent courts at
          Bengaluru, India.
        </p>

        <h2 style={H2_STYLE}>11. Contact</h2>
        <p>
          Questions about these Terms? Reach us at{' '}
          <a href="mailto:connect@codingryder.com" style={{ color: 'var(--green)' }}>
            connect@codingryder.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  useSeo({
    title: 'Privacy Policy | Crowdbash',
    description:
      'How Crowdbash collects, uses, and protects your data. Free-to-play fantasy sports platform privacy practices.',
    path: '/privacy',
  });
  return (
    <div style={PAGE_STYLE}>
      <div style={CONTAINER}>
        {/* TODO: lawyer review before scaling. */}
        <Breadcrumb />
        <h1 style={H1_STYLE}>Privacy Policy</h1>
        <p style={META_STYLE}>Effective: {EFFECTIVE_DATE}</p>

        <p>
          This Privacy Policy explains what information Crowdbash collects, how
          we use it, and the choices you have. We aim to collect only what is
          needed to run the free-to-play fan-engagement experience.
        </p>

        <h2 style={H2_STYLE}>1. Information we collect</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Account details:</strong> first name, last name, email address, optional phone number.</li>
          <li><strong>Usage data:</strong> rooms joined, fantasy XI selections, Bashpoints earned and redeemed, chat messages, leaderboard rank.</li>
          <li><strong>Device data:</strong> browser, IP address, device type — used for security and to keep sessions stable.</li>
          <li><strong>Acceptance log:</strong> the timestamp at which you accept these Terms and Privacy Policy.</li>
        </ul>

        <h2 style={H2_STYLE}>2. How we use it</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>To run gameplay (compute leaderboards, award Bashpoints, deliver redemptions).</li>
          <li>To send transactional email — sign-in OTPs, redemption confirmations.</li>
          <li>To prevent fraud, abuse, and multi-accounting.</li>
          <li>To improve product features based on aggregated usage patterns.</li>
        </ul>

        <h2 style={H2_STYLE}>3. Sharing</h2>
        <p>
          We do not sell your personal data. Limited sharing happens with:
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Service providers we rely on (email delivery, hosting, real-time score feeds).</li>
          <li>Voucher fulfillment partners — only the minimum data needed to deliver your redemption.</li>
          <li>Authorities, where required by law.</li>
        </ul>

        <h2 style={H2_STYLE}>4. Cookies &amp; storage</h2>
        <p>
          We use browser local storage to keep you signed in. We do not use
          third-party advertising cookies on Crowdbash.
        </p>

        <h2 style={H2_STYLE}>5. Data retention</h2>
        <p>
          We keep your account data for as long as your account is active. If
          you ask us to delete your account, we will remove personal data
          within 30 days, except where retention is required for legal,
          accounting, or fraud-prevention purposes.
        </p>

        <h2 style={H2_STYLE}>6. Your rights</h2>
        <p>
          You can request access, correction, or deletion of your personal data
          by writing to{' '}
          <a href="mailto:connect@codingryder.com" style={{ color: 'var(--green)' }}>
            connect@codingryder.com
          </a>
          .
        </p>

        <h2 style={H2_STYLE}>7. Children</h2>
        <p>
          Crowdbash is intended for users aged 18 and over. We do not knowingly
          collect data from anyone under 18.
        </p>

        <h2 style={H2_STYLE}>8. Changes</h2>
        <p>
          We will surface material changes to this Privacy Policy in-app on
          your next sign-in. Continued use after notice constitutes acceptance.
        </p>

        <h2 style={H2_STYLE}>9. Contact</h2>
        <p>
          Privacy questions? Reach us at{' '}
          <a href="mailto:connect@codingryder.com" style={{ color: 'var(--green)' }}>
            connect@codingryder.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function Breadcrumb() {
  return (
    <div style={{ marginBottom: 24, fontSize: 12, color: 'var(--muted)' }}>
      <Link to="/" style={{ color: 'var(--green)' }}>Crowdbash</Link>
      {' · Free to play, skill-based fan engagement'}
    </div>
  );
}

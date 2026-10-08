const engines = [
  { name: 'Avatar III', credits: 12, cents: 60 },
  { name: 'Avatar IV', credits: 97, cents: 483 },
  { name: 'Avatar V', credits: 144, cents: 720 },
];

export function AvatarCostHelp() {
  return <section className="avatar-cost-help" aria-labelledby="avatar-cost-title">
    <span className="eyebrow">HELP & PRICING</span>
    <h1 id="avatar-cost-title">Avatar costs</h1>
    <p>Plan your videos before you render. Each video below includes <strong>one minute of avatar speech</strong>.</p>
    <div className="engine-price-guide">
      <strong>Only the avatar’s speaking time counts here.</strong>
      <p>The original clip played before your reaction is not included. A 30-second avatar script costs about half these estimates; a two-minute script costs about twice as much.</p>
    </div>
    <div className="avatar-cost-table" role="region" aria-label="Avatar cost comparison for 1 to 15 videos" tabIndex={0}>
      <table>
        <caption>Digital Twin reference estimates · USD · 60 seconds of avatar speech per video</caption>
        <thead><tr><th scope="col">Videos</th>{engines.map(engine => <th scope="col" key={engine.name}>{engine.name}</th>)}</tr></thead>
        <tbody>{Array.from({length:15}, (_, i) => i + 1).map(count => <tr key={count} className={[1,5,10,15].includes(count) ? 'cost-milestone' : ''}>
          <th scope="row">{count}</th>{engines.map(engine => <td key={engine.name}><strong>${(count * engine.cents / 100).toFixed(2)}</strong><small>{(count * engine.credits).toLocaleString('en-US')} cr</small></td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <p className="muted">These are HeyGen pay-as-you-go reference estimates for Digital Twins, not guaranteed charges. Credit figures are approximate reference equivalents; your account may be billed in USD. Other avatar types, plans, tests, and additional renders may cost differently. Vektiss subscription and other service costs are not included.</p>
    <a href="https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained" target="_blank" rel="noopener noreferrer">Check HeyGen pricing ↗</a>
  </section>;
}

/**
 * Assign a display bucket for weak-area analytics when no explicit category exists.
 */
function inferWeakCategory(topic, questionText, subTopic) {
  const text = (questionText || '').toLowerCase();
  if (subTopic && subTopic !== 'Concepts') {
    return subTopic;
  }

  const rules = {
    DBMS: [
      { name: 'Normalization & Dependencies', keys: ['normalization', 'denormalization', '1nf', '2nf', '3nf', 'bcnf', 'functional depend'] },
      { name: 'Transactions & Concurrency', keys: ['transaction', 'acid', 'commit', 'rollback', 'savepoint', 'isolation', 'deadlock', 'live lock', 'lock'] },
      { name: 'Joins & Subqueries', keys: ['join', 'subquery', 'union', 'self join', 'cross join', 'inner join', 'outer join', 'exists'] },
      { name: 'Indexes & Performance', keys: ['index', 'explain', 'performance', 'optimize'] },
      { name: 'Views, Triggers & Procedures', keys: ['view', 'trigger', 'stored procedure', 'stored function', 'pl/sql', 't-sql', 'merge'] },
      { name: 'Security & Integrity', keys: ['injection', 'integrity', 'constraint', 'foreign key', 'primary key', 'unique'] },
    ],
    NETWORKING: [
      { name: 'Protocols & Layers', keys: ['tcp', 'udp', 'ip', 'osi', 'protocol', 'http', 'dns', 'dhcp', 'arp'] },
      { name: 'Routing & Switching', keys: ['router', 'switch', 'routing', 'vlan', 'subnet', 'subnetting', 'gateway'] },
      { name: 'Security', keys: ['firewall', 'vpn', 'ssl', 'tls', 'encryption', 'attack', 'security'] },
    ],
    WEBDEV: [
      { name: 'Front-end & React', keys: ['react', 'dom', 'css', 'html', 'component', 'hook', 'virtual dom'] },
      { name: 'Node & Express', keys: ['node', 'express', 'npm', 'middleware', 'api'] },
      { name: 'Databases & MongoDB', keys: ['mongo', 'document', 'collection', 'aggregation'] },
    ],
    PROGRAMMING: [
      { name: 'OOP & Classes', keys: ['class', 'object', 'inheritance', 'polymorphism', 'encapsulation', 'interface'] },
      { name: 'Memory & Performance', keys: ['memory', 'garbage', 'stack', 'heap', 'pointer', 'reference'] },
      { name: 'Concurrency', keys: ['thread', 'async', 'parallel', 'synchronize', 'race'] },
    ],
  };

  const list = rules[topic] || [];
  for (const { name, keys } of list) {
    if (keys.some((k) => text.includes(k))) return name;
  }
  return 'General Concepts';
}

module.exports = { inferWeakCategory };

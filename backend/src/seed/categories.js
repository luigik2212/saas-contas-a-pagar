const defaultCategories = [
  'Moradia',
  'Água',
  'Luz',
  'Internet',
  'Mercado',
  'Transporte',
  'Saúde',
  'Cartão',
  'Assinaturas',
  'Educação',
  'Lazer'
];

async function createDefaultCategories(connection, userId) {
  const values = defaultCategories.map((name) => [name, userId]);
  await connection.query('INSERT INTO categories (name, user_id) VALUES ?', [values]);
}

module.exports = { defaultCategories, createDefaultCategories };

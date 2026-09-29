const ACTIVE_STATUSES = ['Pending', 'Accepted'];

const migrateInvitationIndexes = async (Invitation) => {
  const collection = Invitation.collection;
  let duplicateActivePair;
  try {
    duplicateActivePair = await collection
      .aggregate([
        { $match: { status: { $in: ACTIVE_STATUSES } } },
        {
          $group: {
            _id: { ideaId: '$ideaId', toCandidate: '$toCandidate' },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ])
      .next();
  } catch (error) {
    if (error.code !== 26) throw error;
  }

  if (duplicateActivePair) {
    throw new Error('Cannot migrate invitation indexes while an idea/candidate pair has multiple active invitations.');
  }

  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (error) {
    if (error.code !== 26) throw error;
    indexes = [];
  }

  for (const index of indexes) {
    const fields = Object.keys(index.key || {}).sort().join(',');
    const legacyPairIndex = fields === 'ideaId,toCandidate' && index.unique;
    const statusScopedUniqueIndex =
      fields === 'ideaId,status,toCandidate' && index.unique;
    if (index.name !== '_id_' && (legacyPairIndex || statusScopedUniqueIndex)) {
      await collection.dropIndex(index.name);
    }
  }

  await Invitation.createIndexes();
};

module.exports = migrateInvitationIndexes;
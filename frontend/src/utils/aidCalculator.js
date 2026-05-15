export function calculateBuildingAid(peopleCount) {
  const people = Number(peopleCount) || 0;
  return {
    water: people * 3,
    food: people * 2,
    blankets: people,
  };
}

export function calculateTotalAid(buildings) {
  return buildings.reduce(
    (acc, b) => {
      const aid = b.aidNeeds || calculateBuildingAid(b.peopleCount);
      return {
        water: acc.water + aid.water,
        food: acc.food + aid.food,
        blankets: acc.blankets + aid.blankets,
        people: acc.people + (Number(b.peopleCount) || 0),
      };
    },
    { water: 0, food: 0, blankets: 0, people: 0 }
  );
}

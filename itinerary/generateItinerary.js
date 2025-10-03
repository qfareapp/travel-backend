const Circuit = require('../models/Circuit');
const Homestay = require('../models/Homestay');

const generateItinerary = async (userInput) => {
  const {
    pax,
    days,
    tags,
    experiences: userExperiences,
    theme,
    withCar,
    carType,
    pickup,
    drop,
    budget
  } = userInput;

  // 1. Find matching circuits
  const circuitQuery = {
  categories: { $in: tags },
  experiences: { $in: userExperiences }
};

if (theme === 'offbeat') {
  circuitQuery.isOffbeat = true;
} else if (theme === 'city') {
  circuitQuery.isOffbeat = false;
}
// If theme === 'mixed', don't add isOffbeat filter

const matchingCircuits = await Circuit.find(circuitQuery);


  if (!matchingCircuits.length) {
    throw new Error('No circuits found matching your preferences.');
  }

  // 2. Score circuits by how many preferred experiences they include
  const scoredCircuits = await Promise.all(
    matchingCircuits.map(async (circuit) => {
      const matchedExpCount = circuit.experiences.filter(e => userExperiences.includes(e)).length;
      return { circuit, score: matchedExpCount };
    })
  );

  // 3. Pick best-scoring circuit
  scoredCircuits.sort((a, b) => b.score - a.score);
  const selectedCircuit = scoredCircuits[0].circuit;

  // 4. Fetch homestays under the selected circuit
  const homestays = await Homestay.find({ circuit: selectedCircuit._id });

  if (!homestays.length) {
    throw new Error('No homestays available under the selected circuit.');
  }

  // 5. Score homestays by affordability and proximity
  const scoredStays = homestays.map(stay => {
    const stayCost = stay.pricingType === 'perHead'
      ? pax * stay.price * days
      : stay.price * days;

    const circuitKmRate = selectedCircuit.kmRate?.[carType] || 15; // fallback rate

    const carDistance = withCar ? (stay.distance * 2 + 30 * days) : 0;
    const carCost = withCar ? carDistance * circuitKmRate : 0;

    const totalCost = stayCost + carCost;

    return {
      stay,
      stayCost,
      carCost,
      carDistance,
      totalCost,
      kmRate: circuitKmRate
    };
  });

  // 6. Filter affordable homestays under budget
  const affordableStays = scoredStays.filter(s => s.totalCost <= budget);

  if (!affordableStays.length) {
    throw new Error('No homestay options available within your budget.');
  }

  // 7. Pick the most affordable + closest stay
  affordableStays.sort((a, b) => {
    const budgetDiffA = Math.abs(a.totalCost - budget);
    const budgetDiffB = Math.abs(b.totalCost - budget);
    return budgetDiffA - budgetDiffB || a.stay.distance - b.stay.distance;
  });

  const selectedStay = affordableStays[0];

  // 8. Build day-wise itinerary
  const matchedExperiences = selectedCircuit.experiences
    .filter(exp => userExperiences.includes(exp))
    .slice(0, days);

  const dayWisePlan = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    activity: matchedExperiences[i] || 'Leisure / Free Day'
  }));

  // 9. Final structured result
  return {
    circuit: selectedCircuit.name,
    theme: theme,
    homestay: {
      name: selectedStay.stay.homestayName,
      priceType: selectedStay.stay.pricingType,
      pricePerDay: selectedStay.stay.price,
      total: selectedStay.stayCost,
      distance: selectedStay.stay.distance,
      contact: selectedStay.stay.contact,
      rooms: selectedStay.stay.rooms
    },
    transport: withCar ? {
      pickup,
      drop,
      carType,
      ratePerKm: selectedStay.kmRate,
      totalKm: selectedStay.carDistance,
      total: selectedStay.carCost
    } : null,
    pax,
    days,
    itinerary: dayWisePlan,
    totalCost: selectedStay.totalCost
  };
};

module.exports = generateItinerary;

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Couleurs pour les différentes cartes
const CARD_COLORS = {
  '1': '#10B981',    // Vert
  '2': '#3B82F6',    // Bleu
  '3': '#8B5CF6',    // Violet
  '5': '#F59E0B',    // Jaune/Orange
  '8': '#EF4444',    // Rouge
  '13': '#EC4899',   // Rose
  '21': '#6366F1',   // Indigo
  '40': '#84CC16',   // Lime
  '∞': '#6B7280',    // Gris
  '?': '#F97316'     // Orange foncé
};

const VoteDistributionChart = ({ votes, totalVotes }) => {
  // Calculer la distribution des votes par carte
  const calculateDistribution = () => {
    const distribution = {};
    
    // Compter les votes pour chaque carte
    votes.forEach(vote => {
      const cardValue = vote.value;
      if (distribution[cardValue]) {
        distribution[cardValue]++;
      } else {
        distribution[cardValue] = 1;
      }
    });

    // Convertir en format pour Recharts et filtrer les cartes avec 0 vote
    return Object.entries(distribution)
      .map(([card, count]) => ({
        card,
        votes: count,
        percentage: ((count / totalVotes) * 100).toFixed(1)
      }))
      .filter(item => item.votes > 0)
      .sort((a, b) => b.votes - a.votes); // Trier par nombre de votes décroissant
  };

  const data = calculateDistribution();

  // Si pas de votes, ne pas afficher le graphique
  if (!data.length || totalVotes === 0) {
    return null;
  }

  // Composant personnalisé pour le tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">Carte {data.card}</p>
          <p className="text-sm text-gray-600">
            {data.votes} vote{data.votes > 1 ? 's' : ''} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Composant personnalisé pour les labels
  const renderLabel = ({ card, votes, percentage }) => {
    return `${card} (${votes})`;
  };

  return (
    <div className="mt-0">
      <h4 className="text-lg font-medium text-gray-900 mb-4 text-center">
        Répartition des votes par carte
      </h4>
      
      {/* Nombre total de votes */}
      <p className="text-center text-gray-600 mb-4">
        Nombre total de votes : <span className="font-semibold">{totalVotes}</span>
      </p>
      
      {/* Graphique */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="votes"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={CARD_COLORS[entry.card] || '#6B7280'} 
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value, entry) => `${entry.payload.card} (${entry.payload.votes} votes)`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Tableau récapitulatif sous le graphique */}
      <div className="mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {data.map((item) => (
            <div 
              key={item.card}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: CARD_COLORS[item.card] || '#6B7280' }}
                />
                <span className="font-medium text-gray-900">{item.card}</span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{item.votes}</span>
                <span className="text-xs ml-1">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoteDistributionChart; 
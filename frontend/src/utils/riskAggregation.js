import { distanceKm } from './distanceCalculator.js';
import { calculateRiskScore, getSuggestedAction } from './riskCalculator.js';
import { getEmergencyLabels, normalizeEmergencyTypes } from '../data/sampleData.js';

/** Fotoğrafla bulunan yerin etki alanı (önceki 1,5 km; alan 2× → yarıçap ×√2). */
export const MERGE_RADIUS_KM = 1.5 * Math.SQRT2;

/** Haritada enkaz/foto konumu dairesi (önceki 80 m; alan 2× → yarıçap ×√2). */
export const PHOTO_LOCATION_RADIUS_M = Math.round(80 * Math.SQRT2);

/**
 * Fotoğraf (yıkık/enkaz tespiti) risk puanı.
 */
export function calculatePhotoRiskScore(report) {
  const collapsed = Number(report.collapsed) || 0;
  const damage = Number(report.suggestedDamageLevel) || 1;
  const total = Number(report.totalDetections) || 0;
  let score = collapsed * 45 + damage * 25 + total * 8;
  if (collapsed > 0) score = Math.max(score, 70);
  const conf = report.geoConfidence;
  if (conf != null && conf < 0.5) score = Math.round(score * 0.85);
  return Math.round(score);
}

/** Kullanıcı bildirimi satırı */
export function buildUserRiskRows(buildings) {
  return buildings.map((b) => ({
    id: b.id,
    kind: b.isEnkazSos || b.reportSource === 'home_enkaz' ? 'enkaz_sos' : 'user',
    name: b.name,
    street: b.street,
    lat: b.lat,
    lng: b.lng,
    peopleCount: b.peopleCount,
    damageLevel: b.damageLevel,
    emergencyLabels: getEmergencyLabels(b),
    riskScore: b.riskScore ?? calculateRiskScore(b),
    suggestedAction: b.suggestedAction ?? getSuggestedAction(b.riskScore),
  }));
}

/** Fotoğraf analizi satırı */
export function buildPhotoRiskRows(photoReports) {
  return photoReports
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => {
      const riskScore = calculatePhotoRiskScore(p);
      return {
        id: p.id,
        kind: 'photo',
        name: p.fileName || 'Hasar fotoğrafı',
        street: p.address || '—',
        lat: p.lat,
        lng: p.lng,
        collapsed: p.collapsed,
        intact: p.intact,
        totalDetections: p.totalDetections,
        damageLevel: p.suggestedDamageLevel,
        riskScore,
        createdAt: p.createdAt,
        geoSource: p.geoSource,
      };
    });
}

function centroidLatLng(points) {
  if (!points.length) return { lat: 0, lng: 0 };
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

function maxInternalDistanceKm(points) {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(
        max,
        distanceKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng)
      );
    }
  }
  return Math.round(max * 100) / 100;
}

/** Aynı yarıçap içinde birbirine bağlı kullanıcı kümeleri (BFS). */
function clusterUnassignedUsers(userRows, assignedUser, radiusKm) {
  const clusters = [];
  for (const seed of userRows) {
    if (assignedUser.has(seed.id)) continue;
    const cluster = [];
    const queue = [seed];
    assignedUser.add(seed.id);
    cluster.push(seed);
    while (queue.length) {
      const cur = queue.shift();
      for (const other of userRows) {
        if (assignedUser.has(other.id)) continue;
        if (distanceKm(cur.lat, cur.lng, other.lat, other.lng) <= radiusKm) {
          assignedUser.add(other.id);
          cluster.push(other);
          queue.push(other);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function userDetailsList(users) {
  return users.map(
    (u) => `${u.name} (risk ${u.riskScore}) — ${u.emergencyLabels.join(', ')}`
  );
}

/**
 * Fotoğraf + kullanıcı ve birbirine yakın kullanıcılar aynı yarıçap içinde tek satırda birleşir.
 */
export function buildMergedRiskRows(photoRows, userRows, radiusKm = MERGE_RADIUS_KM) {
  const assignedPhoto = new Set();
  const assignedUser = new Set();
  const merged = [];

  for (const photo of photoRows) {
    const nearby = userRows.filter(
      (u) =>
        !assignedUser.has(u.id) &&
        distanceKm(photo.lat, photo.lng, u.lat, u.lng) <= radiusKm
    );

    if (nearby.length > 0) {
      const userRiskSum = nearby.reduce((s, u) => s + u.riskScore, 0);
      nearby.forEach((u) => assignedUser.add(u.id));
      assignedPhoto.add(photo.id);

      const lat =
        nearby.reduce((s, u) => s + u.lat, photo.lat) / (nearby.length + 1);
      const lng =
        nearby.reduce((s, u) => s + u.lng, photo.lng) / (nearby.length + 1);

      merged.push({
        id: `merged-${photo.id}-${nearby.map((u) => u.id).join('-')}`,
        kind: 'merged',
        mergeType: 'photo_user',
        label: `${photo.name} + ${nearby.length} kullanıcı bildirimi`,
        lat,
        lng,
        photoRisk: photo.riskScore,
        userRisk: userRiskSum,
        riskScore: photo.riskScore + userRiskSum,
        photoId: photo.id,
        userIds: nearby.map((u) => u.id),
        photoDetail: `Yıkık: ${photo.collapsed}, hasar önerisi ${photo.damageLevel}/5`,
        userDetails: nearby.map(
          (u) => `${u.name} (risk ${u.riskScore}) — ${u.emergencyLabels.join(', ')}`
        ),
        suggestedAction: getSuggestedAction(photo.riskScore + userRiskSum),
        distanceKm: Math.min(
          ...nearby.map((u) =>
            Math.round(distanceKm(photo.lat, photo.lng, u.lat, u.lng) * 100) / 100
          )
        ),
      });
    }
  }

  for (const photo of photoRows) {
    if (assignedPhoto.has(photo.id)) continue;
    merged.push({
      id: `solo-photo-${photo.id}`,
      kind: 'merged',
      mergeType: 'photo_only',
      label: photo.name,
      lat: photo.lat,
      lng: photo.lng,
      photoRisk: photo.riskScore,
      userRisk: 0,
      riskScore: photo.riskScore,
      photoId: photo.id,
      userIds: [],
      photoDetail: `Yıkık: ${photo.collapsed}, tespit: ${photo.totalDetections}`,
      userDetails: [],
      suggestedAction: getSuggestedAction(photo.riskScore),
    });
  }

  const userClusters = clusterUnassignedUsers(userRows, assignedUser, radiusKm);

  for (const cluster of userClusters) {
    if (cluster.length === 1) {
      const user = cluster[0];
      merged.push({
        id: `solo-user-${user.id}`,
        kind: 'merged',
        mergeType: 'user_only',
        label: user.name,
        lat: user.lat,
        lng: user.lng,
        photoRisk: 0,
        userRisk: user.riskScore,
        riskScore: user.riskScore,
        photoId: null,
        userIds: [user.id],
        photoDetail: '—',
        userDetails: [
          `${user.street} · ${user.peopleCount} kişi · ${user.emergencyLabels.join(', ')}`,
        ],
        suggestedAction: user.suggestedAction,
      });
      continue;
    }

    const userRiskSum = cluster.reduce((s, u) => s + u.riskScore, 0);
    const { lat, lng } = centroidLatLng(cluster);
    const totalPeople = cluster.reduce((s, u) => s + (Number(u.peopleCount) || 0), 0);

    merged.push({
      id: `merged-users-${cluster.map((u) => u.id).join('-')}`,
      kind: 'merged',
      mergeType: 'user_user',
      label: `${cluster.length} kullanıcı bildirimi (aynı bölge)`,
      lat,
      lng,
      photoRisk: 0,
      userRisk: userRiskSum,
      riskScore: userRiskSum,
      photoId: null,
      userIds: cluster.map((u) => u.id),
      photoDetail: '—',
      userDetails: userDetailsList(cluster),
      userSummary: `${cluster.length} bina · ${totalPeople} kişi`,
      suggestedAction: getSuggestedAction(userRiskSum),
      distanceKm: maxInternalDistanceKm(cluster),
    });
  }

  return merged.sort((a, b) => b.riskScore - a.riskScore);
}

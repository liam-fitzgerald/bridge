import { azimuth } from 'azimuth-js';

import { usePointCache } from 'store/pointCache';

import { eqAddr, ETH_ZERO_ADDR } from './wallet';

const NULL_PERMISSIONS = {
  isPlanet: false,
  isStar: false,
  isGalaxy: false,
  //
  isOwner: false,
  isActiveOwner: false,
  isTransferProxy: false,
  isManagementProxy: false,
  //
  isManagementProxySet: false,
  isSpawnProxySet: false,
  isVotingProxySet: false,
  isTransferProxySet: false,
  //
  canManage: false,
  canTransfer: false,
  canSpawn: false,
  canVote: false,
};

/**
 * @param {string} address
 * @param {number} point
 */
export default function usePermissionsForPoint(address, point) {
  const { getDetails } = usePointCache();

  return getDetails(point).matchWith({
    Nothing: () => NULL_PERMISSIONS,
    Just: ({ value: details }) => {
      const pointSize = azimuth.getPointSize(point);
      const isPlanet = pointSize === azimuth.PointSize.Planet;
      const isStar = pointSize === azimuth.PointSize.Star;
      const isGalaxy = pointSize === azimuth.PointSize.Galaxy;

      const isOwner = eqAddr(address, details.owner);
      const isActiveOwner = isOwner && details.active;
      const isManagementProxy = eqAddr(address, details.managementProxy);
      const isSpawnProxy = eqAddr(address, details.spawnProxy);
      const isVotingProxy = eqAddr(address, details.votingProxy);
      const isTransferProxy = eqAddr(address, details.transferProxy);

      const isManagementProxySet = !eqAddr(
        ETH_ZERO_ADDR,
        details.managementProxy
      );
      const isSpawnProxySet = !eqAddr(ETH_ZERO_ADDR, details.spawnProxy);
      const isVotingProxySet = !eqAddr(ETH_ZERO_ADDR, details.votingProxy);
      const isTransferProxySet = !eqAddr(ETH_ZERO_ADDR, details.transferProxy);

      const canManage = isOwner || isManagementProxy;
      const canTransfer = isOwner || isTransferProxy;
      const canSpawn = (isStar || isGalaxy) && (isOwner || isSpawnProxy);
      const canVote = isGalaxy && (isOwner || isVotingProxy);

      return {
        isPlanet,
        isStar,
        isGalaxy,
        //
        isOwner,
        isActiveOwner,
        isTransferProxy,
        isManagementProxy,
        //
        isManagementProxySet,
        isSpawnProxySet,
        isVotingProxySet,
        isTransferProxySet,
        //
        canManage,
        canTransfer,
        canSpawn,
        canVote,
      };
    },
  });
}

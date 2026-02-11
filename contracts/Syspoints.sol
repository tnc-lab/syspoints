// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SyspointsReviews {
    event ReviewAnchored(
        address indexed user,
        bytes32 indexed reviewHash,
        bytes32 indexed establishmentId,
        uint256 timestamp
    );

    function anchorReview(
        address user,
        bytes32 reviewHash,
        bytes32 establishmentId
    ) external {
        require(user != address(0), "Invalid user");
        require(reviewHash != bytes32(0), "Invalid hash");
        require(establishmentId != bytes32(0), "Invalid establishment");

        emit ReviewAnchored(user, reviewHash, establishmentId, block.timestamp);
    }
}

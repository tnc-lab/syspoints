// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Syspoints {
    event ReviewAdded(
        address indexed user,
        string establishment,
        uint256 points
    );

    function addReview(
        string memory establishment,
        string memory review
    ) public returns (uint256) {
        require(bytes(establishment).length > 0, "Empty establishment");
        require(bytes(review).length > 0, "Empty review");

        uint256 points = 10;

        emit ReviewAdded(msg.sender, establishment, points);
        return points;
    }
}
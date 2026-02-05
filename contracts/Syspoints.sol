// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "./SYSPT.sol";

contract Syspoints {
    // @notice Token ERC-20 SYSPT
    SYSPT public sysptToken;

    uint256 public constant POINTS_REVIEW = 10;

    event ReviewAdded(
        address indexed user,
        string establishment,
        uint256 points
    );

    // @param erc20Address endereción del contrato SYSPT
    constructor(address erc20Address) {
        require(erc20Address != address(0), "Invalid token");
        sysptToken = SYSPT(erc20Address);
    }

    function addReview(
        string memory establishment,
        string memory review
    ) public returns (uint256) {
        require(bytes(establishment).length > 0, "Empty establishment");
        require(bytes(review).length > 0, "Empty review");

        uint256 points = POINTS_REVIEW;

        // @notice Mint del token SYSPT
        sysptToken.mint(msg.sender, points * 10**18);

        emit ReviewAdded(msg.sender, establishment, points);
        return points;
    }
}
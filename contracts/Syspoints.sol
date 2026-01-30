// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Syspoints {

    struct Review {
        bytes32 entityId;
        bytes32 reviewHash;
        address reviewer;
        uint256 timestamp;
    }

    Review[] public reviews;

    mapping(address => uint256) public reputation;
    mapping(address => uint256) public lastReviewAt;

    uint256 public constant POINTS_PER_REVIEW = 10;
    uint256 public constant MIN_TIME_BETWEEN_REVIEWS = 1 minutes;

    event ReviewSubmitted(
        uint256 indexed reviewId,
        bytes32 indexed entityId,
        address indexed reviewer,
        uint256 points
    );

    function submitReview(bytes32 entityId, bytes32 reviewHash) external {
        require(entityId != bytes32(0), "Invalid entity");
        require(reviewHash != bytes32(0), "Invalid hash");

        require(
            block.timestamp - lastReviewAt[msg.sender] >= MIN_TIME_BETWEEN_REVIEWS,
            "Wait before submitting another review"
        );

        reviews.push(
            Review({
                entityId: entityId,
                reviewHash: reviewHash,
                reviewer: msg.sender,
                timestamp: block.timestamp
            })
        );

        reputation[msg.sender] += POINTS_PER_REVIEW;
        lastReviewAt[msg.sender] = block.timestamp;

        emit ReviewSubmitted(
            reviews.length - 1,
            entityId,
            msg.sender,
            POINTS_PER_REVIEW
        );
    }

    function getReviewsCount() external view returns (uint256) {
        return reviews.length;
    }
}
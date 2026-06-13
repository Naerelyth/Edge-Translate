/** @jsx h */
import { h } from "preact";
import { useEffect, useState, useRef } from "preact/hooks";
import root from "react-shadow/styled-components";
import styled from "styled-components";

const NoticeContainer = styled.div`
    position: fixed;
    right: 20px;
    top: 50%;
    margin-top: -20px; /* half of height roughly */
    z-index: 2147483647; /* Max z-index to stay on top */
    display: flex;
    align-items: center;
    background-color: #ffffff;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px 16px;
    cursor: grab;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    user-select: none;
    transition: box-shadow 0.2s ease;
    touch-action: none;

    &:active {
        cursor: grabbing;
    }

    &:hover {
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
`;

const NoticeText = styled.span`
    font-size: 14px;
    color: #333333;
    font-weight: 500;
    margin-right: 8px;
`;

const ActionButton = styled.button`
    background-color: #0078d4; /* Edge blue */
    color: #ffffff;
    border: none;
    border-radius: 12px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
        background-color: #006abc;
    }
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: #999999;
    font-size: 16px;
    cursor: pointer;
    margin-left: 8px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        color: #666666;
    }
`;

const PdfNotice = () => {
    const [pdfUrls, setPdfUrls] = useState([]);
    const [isVisible, setIsVisible] = useState(false);

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const draggingRef = useRef(false);
    const posRef = useRef({ x: 0, y: 0 });
    const startRef = useRef({ x: 0, y: 0 });
    const boundsRef = useRef({ minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity });

    useEffect(() => {
        const handleMessage = (message) => {
            if (message && message.action === "BACKGROUND_PDF_DETECTED" && message.url) {
                setPdfUrls((prev) => {
                    if (!prev.includes(message.url)) {
                        return [...prev, message.url];
                    }
                    return prev;
                });
                setIsVisible(true);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    const handleOpen = (e) => {
        e.stopPropagation();
        if (pdfUrls.length === 0) return;
        const targetUrl = pdfUrls[pdfUrls.length - 1]; // Use the most recently detected
        const viewerUrl = chrome.runtime.getURL(
            `pdf/viewer.html?file=${encodeURIComponent(targetUrl)}`
        );

        // Send message to background to open tab
        chrome.runtime.sendMessage({
            action: "OPEN_PDF_TAB",
            url: viewerUrl,
        });
    };

    const handleClose = (e) => {
        e.stopPropagation();
        setIsVisible(false);
    };

    const handlePointerDown = (e) => {
        // Ignore clicks on buttons
        if (e.target.tagName.toLowerCase() === "button") return;
        draggingRef.current = true;

        const rect = e.currentTarget.getBoundingClientRect();
        const currentX = posRef.current.x;
        const currentY = posRef.current.y;

        const naturalLeft = rect.left - currentX;
        const naturalRight = rect.right - currentX;
        const naturalTop = rect.top - currentY;
        const naturalBottom = rect.bottom - currentY;

        boundsRef.current = {
            minX: -naturalLeft,
            maxX: window.innerWidth - naturalRight,
            minY: -naturalTop,
            maxY: window.innerHeight - naturalBottom,
        };

        startRef.current = {
            x: e.clientX - currentX,
            y: e.clientY - currentY,
        };
        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!draggingRef.current) return;
        let newX = e.clientX - startRef.current.x;
        let newY = e.clientY - startRef.current.y;

        newX = Math.max(boundsRef.current.minX, Math.min(newX, boundsRef.current.maxX));
        newY = Math.max(boundsRef.current.minY, Math.min(newY, boundsRef.current.maxY));

        posRef.current = { x: newX, y: newY };
        setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = (e) => {
        draggingRef.current = false;
        e.target.releasePointerCapture(e.pointerId);
    };

    if (!isVisible || pdfUrls.length === 0) return null;

    return (
        <root.div>
            <NoticeContainer
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <NoticeText>📄 PDF Detected</NoticeText>
                <ActionButton onClick={handleOpen}>Open</ActionButton>
                <CloseButton onClick={handleClose}>&times;</CloseButton>
            </NoticeContainer>
        </root.div>
    );
};

export default PdfNotice;

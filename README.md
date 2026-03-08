# QUIPU Backoffice

서울시립대학교 컴퓨터 학술 중앙동아리 QUIPU의 지원자 관리 백오피스 프로젝트입니다.  
메인 웹 지원 폼으로 수집된 데이터를 운영진이 조회하고 관리할 수 있도록 제공합니다.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Development Timeline](#development-timeline)
- [Getting Started](#getting-started)

## Overview

본 프로젝트는 지원자 정보 검토와 운영 업무 효율화를 위한 내부 관리 도구입니다.  
프론트엔드는 React 기반 관리자 화면으로 구성되며, 백엔드는 Express API 서버로 동작합니다.  
운영진은 목록 조회, 상세 확인, 파일 다운로드, 데이터 내보내기 기능을 통해 지원 정보를 체계적으로 관리할 수 있습니다.

## Features

- 지원자 목록 및 상세 정보 조회
- 키보드 단축키 기반 빠른 탐색 및 모달 제어
- 포트폴리오 PDF 다운로드
- 지원 데이터 Excel 내보내기
- 관리자 인증 기반 접근 제어

## Tech Stack

- Frontend: React
- Backend: Express
- Database: MySQL

## Development Timeline

| Project | Period |
|---|---|
| Backoffice Web | 2024.07 - 2024.08 |

## Getting Started

### Install

```bash
cd frontend && npm install
cd ../backend && npm install
```

### Run

```bash
# backend
cd backend
npm start

# frontend
cd ../frontend
npm start
```

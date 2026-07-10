#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <iostream>
#include <string>
#include <vector>

using namespace std;
using namespace cv;
using namespace cv::dnn;

int main(int argc, char** argv) {
    if (argc < 4) {
        cerr << "Usage: face_engine <video_path> <start_sec> <duration_sec> [fps] [prototxt] [caffemodel]" << endl;
        return 1;
    }

    string videoPath = argv[1];
    double startSec = stod(argv[2]);
    double durationSec = stod(argv[3]);
    double targetFps = argc > 4 ? stod(argv[4]) : 2.0;
    string prototxt = argc > 5 ? argv[5] : "models/deploy.prototxt";
    string caffemodel = argc > 6 ? argv[6] : "models/res10_300x300_ssd_iter_140000.caffemodel";

    Net net;
    try {
        net = readNetFromCaffe(prototxt, caffemodel);
        net.setPreferableBackend(DNN_BACKEND_OPENCV);
        net.setPreferableTarget(DNN_TARGET_CPU);
    } catch (const Exception& e) {
        cerr << "Error loading model: " << e.what() << endl;
        return 1;
    }

    VideoCapture cap(videoPath);
    if (!cap.isOpened()) {
        cerr << "Error opening video file" << endl;
        return 1;
    }

    cap.set(CAP_PROP_POS_MSEC, startSec * 1000.0);

    double videoFps = cap.get(CAP_PROP_FPS);
    if (videoFps <= 0) videoFps = 30.0;

    int frameSkip = max(1, (int)round(videoFps / targetFps));
    double currentTime = startSec;

    cout << "[";

    bool firstItem = true;
    Mat frame;
    int frameCount = 0;

    while (cap.read(frame)) {
        if (currentTime > startSec + durationSec) {
            break;
        }

        if (frameCount % frameSkip == 0) {
            Mat blob = blobFromImage(frame, 1.0, Size(300, 300), Scalar(104.0, 177.0, 123.0), false, false);
            net.setInput(blob);
            Mat detection = net.forward();

            Mat detectionMat(detection.size[2], detection.size[3], CV_32F, detection.ptr<float>());

            // Collect ALL faces above threshold (not just the best one)
            // so callers can cluster multiple speakers
            for (int i = 0; i < detectionMat.rows; i++) {
                float confidence = detectionMat.at<float>(i, 2);
                if (confidence < 0.4f) continue;

                float x1 = max(0.0f, min(1.0f, detectionMat.at<float>(i, 3)));
                float y1 = max(0.0f, min(1.0f, detectionMat.at<float>(i, 4)));
                float x2 = max(0.0f, min(1.0f, detectionMat.at<float>(i, 5)));
                float y2 = max(0.0f, min(1.0f, detectionMat.at<float>(i, 6)));

                float w = x2 - x1;
                float h = y2 - y1;
                if (w <= 0 || h <= 0) continue;

                if (!firstItem) cout << ",";
                cout << "{\"time\":" << currentTime
                     << ",\"x\":" << x1 << ",\"y\":" << y1
                     << ",\"w\":" << w << ",\"h\":" << h
                     << ",\"confidence\":" << confidence << "}";
                firstItem = false;
            }
        }
        
        frameCount++;
        currentTime += 1.0 / videoFps;
    }

    cout << "]" << endl;
    return 0;
}

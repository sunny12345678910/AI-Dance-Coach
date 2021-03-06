import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';

import { RNCamera } from 'react-native-camera'; // For recording
import CameraRoll from '@react-native-community/cameraroll'; // For accessing camera roll
import ImagePicker from 'react-native-image-picker'; // For choosing a video in camera roll
import Config from 'react-native-config';
import RNFetchBlob from 'rn-fetch-blob'; // For fetching video file and json file
import { unzip } from 'react-native-zip-archive'; // For unzipping the result

const RNFS = require('react-native-fs');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  recordButtonContainer: {
    flex: 0.2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B82303',
  },
  recordButton: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    marginHorizontal: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonText: {
    fontSize: 14,
    color: '#B82303',
    fontWeight: 'bold',
  },
  horizontalButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorText: {
    fontSize: 20,
    color: 'gray',
    fontWeight: 'bold',
  },
});

class CameraView extends Component {
  constructor(props) {
    super(props);
    this.state = this.getInitialState();
  }

  getInitialState() {
    return {
      recording: false,
      resultVideoPath: null,
      recordedVideoUri: null,
      recordedVideoCodec: null,
      isServerRunning: false,
    };
  }

  saveVideoToCameraRoll = async (uri) => {
    let videoUri = null;
    try {
      videoUri = await CameraRoll.saveToCameraRoll(uri); // Save video that is recorded
    } catch (error) {
      console.log(error.message);
    }
    return videoUri;
  }

  selectVideo = () => {
    const options = {
      mediaType: 'video',
      videoQuality: 'high',
      allowsEditing: false,
      noCompressing: true,
    };

    // Open camera roll to select video to send
    return ImagePicker.launchImageLibrary(options, (response) => {
      if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else {
        this.setState({ isServerRunning: true }, () => {
          this.sendVideoAndConfigToServer(response.uri);
        });
      }
    });
  }

  sendVideoAndConfigToServer = async (uri) => {
    // Append mp4 video
    const codec = 'H264';
    const type = `video/${codec}`;

    // Append json config
    const config = {
      is_sample: false,
      compare_to: 'three_new.mp4',
    };
    const configJson = JSON.stringify(config);
    const configFileName = '/config.json';
    const jsonPath = RNFS.DocumentDirectoryPath + configFileName;

    // Write json to the file
    await RNFS.writeFile(jsonPath, configJson, 'utf8');
    const blobUri = uri.replace('file://', '');
    // console.log('json', jsonPath);
    RNFetchBlob
      .config({
        fileCache: true,
        // by adding this option, the temp files will have a file extension
        appendExt: 'zip',
      })
      .fetch('POST', Config.SERVER_ENDPOINT, {
        'Content-Type': 'multipart/form-data',
      }, [
        {
          name: 'file',
          filename: 'video.mp4',
          type,
          data: RNFetchBlob.wrap(blobUri),
        },
        {
          name: 'file',
          filename: 'video_config.json',
          type: 'applpication/json',
          data: RNFetchBlob.wrap(jsonPath),
        },
      ])
      .then((res) => {
        this.unzipResponse(res.path());
      })
      .catch((error) => {
        console.log('error', error.message);
      });
  }

  unzipResponse = (resPath) => {
    const homeDir = RNFS.DocumentDirectoryPath;
    const folder = `/AI-Dance-Coach/${Date.now()}`; // Path where result file stored on the phone
    const storeDir = homeDir + folder;

    const { setOpenPoseResult } = this.props;
    return unzip(resPath, storeDir, 'utf-8')
      .then((path) => {
        this.setState({ isServerRunning: false }, () => {
          setOpenPoseResult(path);
        });
      });
  }

  startRecording = async () => {
    this.setState({ recording: true });
    // default to mp4 for android as codec is not set
    const { uri } = await this.camera.recordAsync();

    this.saveVideoToCameraRoll(uri);
    this.setState({ recording: false });
  }

  stopRecording = () => {
    this.camera.stopRecording();
  }

  render() {
    const { recording, isServerRunning } = this.state;

    return (
      isServerRunning
        ? (
          <View style={styles.loadingView}>
            <ActivityIndicator size="large" />
            <Text style={styles.indicatorText}>OpenPose is running...</Text>
          </View>
        )
        : (
          <>
            <RNCamera
              ref={(ref) => {
                this.camera = ref;
              }}
              style={styles.preview}
              type={RNCamera.Constants.Type.back}
              flashMode={RNCamera.Constants.FlashMode.on}
              captureAudio={false}
            />
            <View
              style={styles.recordButtonContainer}
            >
              <View style={styles.horizontalButtonContainer}>
                <TouchableOpacity
                  onPress={recording ? this.stopRecording : this.startRecording}
                  style={styles.recordButton}
                >
                  <Text style={styles.recordButtonText}>
                    {recording ? 'STOP' : 'RECORD'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={this.selectVideo}
                  style={styles.recordButton}
                >
                  <Text style={styles.recordButtonText}>
                    Select
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )
    );
  }
}

CameraView.propTypes = {
  setOpenPoseResult: PropTypes.func.isRequired,
};

export default CameraView;
